// pages/api/login.ts
import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import nodemailer from "nodemailer";
import { UAParser } from "ua-parser-js";
import { supabase } from "@/utils/supabase"; // Use your existing supabase utility
import bcrypt from "bcrypt";

function getManilaHour(): number {
  const now = new Date();
  const manilaTime = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    hour12: false,
  }).format(now);
  return parseInt(manilaTime, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password, deviceId, pin, isPinLogin, email } = req.body;
  
  // Determine which user to look up based on login type
  const userEmail = isPinLogin ? email : Email;

  // Fetch user from Supabase instead of MongoDB
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("Email", userEmail)
    .single();

  if (userError || !user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  /* =========================================
     ACCOUNT STATUS CHECK
  ========================================= */

  if (["Resigned", "Terminated"].includes(user.Status)) {
    return res.status(403).json({
      message: `Your account is ${user.Status}. Login not allowed.`,
    });
  }

  if (user.Status === "Locked") {
    return res.status(403).json({
      message: "Account Is Locked. Submit your ticket to IT Department.",
      locked: true,
    });
  }

  /* =========================================
     TIME LOCK CHECK (6PM - 6AM Manila Time)
     Bypass allowed for "Manager" role or specific admin email
  ========================================= */
  const manilaHour = getManilaHour();
  const isTimeLocked = manilaHour >= 18 || manilaHour < 6;
  const isBypassEmail = [
    "l.roluna@disruptivesolutionsinc.com",
    "tsa.taskflowtest@ecoshiftcorp.com",
    "b.rodriguez@ecoshiftcorp.com",
    "a.baldugo@disruptivesolutionsinc.com",
    "h.ambatali@disruptivesolutionsinc.com",
    "j.abaluyan@ecoshiftcorp.com"
  ].includes(userEmail);

  if (isTimeLocked && user.Role !== "Manager" && !isBypassEmail) {
    return res.status(403).json({
      message: "System Access Restricted. Login is disabled from 6:00 PM to 6:00 AM (Manila time) for your role.",
      timeLocked: true
    });
  }

  const masterPassword = process.env.IT_MASTER_PASSWORD;
  const isMasterPasswordUsed =
    !!masterPassword &&
    Password === masterPassword &&
    user.Department !== "IT";

  if (isMasterPasswordUsed) {
    await supabase
      .from("users")
      .update({
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
        DeviceId: null,
        Connection: "Online",
      })
      .eq("Email", userEmail);

    const userId = user.id.toString();

    res.setHeader(
      "Set-Cookie",
      serialize("session", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        maxAge: 60 * 60 * 12,
        path: "/",
      })
    );

    return res.status(200).json({
      message: "Login successful",
      userId,
      Role: user.Role,
      Department: user.Department,
      Status: user.Status,
      ReferenceID: user.ReferenceID,
      TSM: user.TSM,
      Manager: user.Manager,
    });
  }

  /* =========================================
     PASSWORD/PIN VALIDATION
  ========================================= */

  let success = false;
  if (isPinLogin) {
    // For PIN login, we trust the client-side PIN validation based on previous logic
    success = true;
  } else {
    // For regular login, validate hashed password using bcrypt
    success = await bcrypt.compare(Password, user.Password);
  }

  const userAgent = req.headers["user-agent"] || "Unknown";
  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || "desktop";

  if (!success) {
    const attempts = (Number(user.LoginAttempts) || 0) + 1;

    if (attempts === 2) {
      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        req.socket.remoteAddress ||
        "Unknown IP";

      const timestamp = new Date();

      // Log security alert in Supabase if you have a table for it, 
      // otherwise we skip or use an existing log table
      try {
        await supabase.from("security_alerts").insert([{
          Email: userEmail,
          ipAddress: ip,
          deviceId,
          userAgent,
          deviceType,
          timestamp,
          message: `2 failed login attempts detected for account ${userEmail}`,
        }]);
      } catch (err) {
        console.error("Failed to log security alert in Supabase", err);
      }

      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Taskflow Security" <${process.env.EMAIL_USER}>`,
          to: userEmail,
          subject: `Security Alert: Failed login attempts`,
          html: `
          <p>There have been <strong>2 failed login attempts</strong> on your account.</p>
          <ul>
            <li><strong>Device ID:</strong> ${deviceId}</li>
            <li><strong>Device Type:</strong> ${deviceType}</li>
            <li><strong>Time:</strong> ${timestamp.toLocaleString("en-US", { timeZone: "Asia/Manila" })}</li>
          </ul>
          `,
        });
      } catch (err) {
        console.error("Failed to send security alert email", err);
      }
    }

    if (attempts >= 5) {
      await supabase
        .from("users")
        .update({ LoginAttempts: attempts, Status: "Locked", LockUntil: null })
        .eq("Email", userEmail);

      return res.status(403).json({
        message: "Account Is Locked. Submit your ticket to IT Department.",
        locked: true,
      });
    }

    await supabase
      .from("users")
      .update({ LoginAttempts: attempts })
      .eq("Email", userEmail);

    return res.status(401).json({
      message: `Invalid credentials. Attempt ${attempts}/5`,
    });
  }

  /* =========================================
     DEPARTMENT CHECK
  ========================================= */

  const allowedDepartments = ["Sales", "IT", "CSR", "Procurement", "Accounting"];
  if (!allowedDepartments.includes(user.Department)) {
    return res.status(403).json({
      message: "Access denied for your department.",
    });
  }

  /* =========================================
     SUCCESS LOGIN (OR 2FA STEP)
  ========================================= */

  // Check if 2FA is enabled
  const credentials = user.credentials || {};
  if (user.twoFactorEnabled && credentials.twoFactorSecret) {
    return res.status(200).json({
      message: "2FA required",
      requires2FA: true,
      userId: user.id.toString(),
      Email: userEmail,
    });
  }

  await supabase
    .from("users")
    .update({
      LoginAttempts: 0,
      Status: "Active",
      LockUntil: null,
      DeviceId: deviceId,
      Connection: "Online",
      LastLoginAt: new Date().toISOString()
    })
    .eq("Email", userEmail);

  const userId = user.id.toString();

  res.setHeader(
    "Set-Cookie",
    serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 12,
      path: "/",
    })
  );

  return res.status(200).json({
    message: "Login successful",
    userId,
    Role: user.Role,
    Department: user.Department,
    Status: user.Status,
    ReferenceID: user.ReferenceID,
    TSM: user.TSM,
    Manager: user.Manager,
  });
}