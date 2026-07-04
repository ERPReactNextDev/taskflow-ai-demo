"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";

interface ChartDataItem {
  name: string;
  conversion: number;
  fill: string;
}

interface SalesPipelineCardProps {
  obCallsCount?: number;
  obCallsTarget?: number;
  loadingObCalls?: boolean;
  loadingObCallsTarget?: boolean;
  quotesCount?: number;
  quotesTarget?: number;
  loadingQuotes?: boolean;
  callsToQuotesCount?: number;
  loadingCallsToQuotes?: boolean;
  quoteToSOQuotationCount?: number;
  quoteToSOSalesOrderCount?: number;
  loadingQuoteToSO?: boolean;
  soToSISalesOrderCount?: number;
  soToSIDeliveredCount?: number;
  // New Account Development
  newAccountCount?: number;
  newAccountTarget?: number;
  loadingNewAccount?: boolean;
}

export const SalesPipelineCard: React.FC<SalesPipelineCardProps> = ({
  obCallsCount = 0,
  obCallsTarget = 0,
  loadingObCalls = false,
  loadingObCallsTarget = false,
  quotesCount = 0,
  quotesTarget = 120, // Default target
  loadingQuotes = false,
  callsToQuotesCount = 0,
  loadingCallsToQuotes = false,
  quoteToSOQuotationCount = 0,
  quoteToSOSalesOrderCount = 0,
  loadingQuoteToSO = false,
  soToSISalesOrderCount = 0,
  soToSIDeliveredCount = 0,
  newAccountCount = 0,
  newAccountTarget = 2,
  loadingNewAccount = false,
}) => {
  const obCallsPercentage = obCallsTarget > 0 ? Math.round((obCallsCount / obCallsTarget) * 100) : 0;
  const quotesPercentage = quotesTarget > 0 ? Math.round((quotesCount / quotesTarget) * 100) : 0;
  const callsToQuotePercentage = obCallsCount > 0 ? Math.round((callsToQuotesCount / obCallsCount) * 100) : 0;
  const callsToQuoteTargetPercentage = 20;
  const callsToQuoteAchievementPercentage = callsToQuoteTargetPercentage > 0 ? Math.round((callsToQuotePercentage / callsToQuoteTargetPercentage) * 100) : 0;

  // Calculate rating for OB Calls
  let obCallsRating = 1;
  if (obCallsPercentage >= 91) {
    obCallsRating = 5;
  } else if (obCallsPercentage >= 81) {
    obCallsRating = 4;
  } else if (obCallsPercentage >= 61) {
    obCallsRating = 3;
  } else if (obCallsPercentage >= 50) {
    obCallsRating = 2;
  }

  // Calculate rating for Calls → Quote
  let callsToQuoteRating = 1;
  if (callsToQuotePercentage >= 20) {
    callsToQuoteRating = 5;
  } else if (callsToQuotePercentage >= 14.01) {
    callsToQuoteRating = 4;
  } else if (callsToQuotePercentage >= 12.01) {
    callsToQuoteRating = 3;
  } else if (callsToQuotePercentage >= 10.01) {
    callsToQuoteRating = 2;
  }

  // Calculate rating for Quotes Generated
  let quotesRating = 1;
  if (quotesPercentage >= 91) {
    quotesRating = 5;
  } else if (quotesPercentage >= 81) {
    quotesRating = 4;
  } else if (quotesPercentage >= 61) {
    quotesRating = 3;
  } else if (quotesPercentage >= 50) {
    quotesRating = 2;
  }

  // Calculate Quote → SO
  const quoteToSOPercentage = quoteToSOQuotationCount > 0 ? Math.round((quoteToSOSalesOrderCount / quoteToSOQuotationCount) * 100) : 0;
  const quoteToSOTargetPercentage = 30;
  const quoteToSOAchievementPercentage = quoteToSOTargetPercentage > 0 ? Math.round((quoteToSOPercentage / quoteToSOTargetPercentage) * 100) : 0;

  // Calculate rating for Quote → SO
  let quoteToSORating = 1;
  if (quoteToSOPercentage >= 30) {
    quoteToSORating = 5;
  } else if (quoteToSOPercentage >= 25.01) {
    quoteToSORating = 4;
  } else if (quoteToSOPercentage >= 20.01) {
    quoteToSORating = 3;
  } else if (quoteToSOPercentage >= 15.01) {
    quoteToSORating = 2;
  }

  // Calculate SO → SI
  const soToSIPercentage = soToSISalesOrderCount > 0 ? Math.round((soToSIDeliveredCount / soToSISalesOrderCount) * 100) : 0;
  const soToSITargetPercentage = 70;
  const soToSIAchievementPercentage = soToSITargetPercentage > 0 ? Math.round((soToSIPercentage / soToSITargetPercentage) * 100) : 0;

  // Calculate rating for SO → SI
  let soToSIRating = 1;
  if (soToSIPercentage >= 70) {
    soToSIRating = 5;
  } else if (soToSIPercentage >= 60.01) {
    soToSIRating = 4;
  } else if (soToSIPercentage >= 50.01) {
    soToSIRating = 3;
  } else if (soToSIPercentage >= 40.01) {
    soToSIRating = 2;
  }

  // Calculate New Account Development — target 2/month
  const newAccountPercentage = newAccountTarget > 0 ? Math.round((newAccountCount / newAccountTarget) * 100) : 0;
  let newAccountRating = 1;
  if (newAccountPercentage >= 91) {
    newAccountRating = 5;
  } else if (newAccountPercentage >= 81) {
    newAccountRating = 4;
  } else if (newAccountPercentage >= 61) {
    newAccountRating = 3;
  } else if (newAccountPercentage >= 50) {
    newAccountRating = 2;
  }

  // Create chart data using current card's values
  const chartData: ChartDataItem[] = [
    {
      name: "Calls → Quote",
      conversion: callsToQuotePercentage,
      fill: "#3b82f6"
    },
    {
      name: "Quote → SO",
      conversion: quoteToSOPercentage,
      fill: "#10b981"
    },
    {
      name: "SO → SI",
      conversion: soToSIPercentage,
      fill: "#f59e0b"
    }
  ];

  const chartConfig = {
    conversion: { label: "Conversion Rate (%)", color: "#3b82f6" },
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          Sales pipeline — conversion metrics
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 w-full">
          {/* OB Calls */}
          <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {loadingObCalls ? <Spinner className="w-6 h-6" /> : obCallsCount}
            </div>
            <div className="text-xs font-medium text-gray-600">OB Calls</div>
            <div className="text-xs text-gray-500">
              Target: {loadingObCallsTarget ? "..." : obCallsTarget} • Achievement: {obCallsPercentage}% • Rating: {obCallsRating}
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: `${Math.min(obCallsPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Quotes generated */}
          <div className="bg-green-50 p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {loadingQuotes ? <Spinner className="w-6 h-6" /> : quotesCount}
            </div>
            <div className="text-xs font-medium text-gray-600">Quotes generated</div>
            <div className="text-xs text-gray-500">
              Target: {quotesTarget} • Achievement: {quotesPercentage}% • Rating: {quotesRating}
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${Math.min(quotesPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Calls → Quote */}
          <div className="bg-yellow-50 p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {loadingCallsToQuotes ? <Spinner className="w-6 h-6" /> : `${callsToQuotesCount} (${callsToQuotePercentage}%)`}
            </div>
            <div className="text-xs font-medium text-gray-600">Calls → Quote</div>
            <div className="text-xs text-gray-500">Target: {callsToQuoteTargetPercentage}% • Achievement: {callsToQuoteAchievementPercentage}% • Rating: {callsToQuoteRating}</div>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-yellow-500 h-2 rounded-full" 
                style={{ width: `${Math.min(callsToQuoteAchievementPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Quote → SO */}
          <div className="bg-orange-50 p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {loadingQuoteToSO ? <Spinner className="w-6 h-6" /> : `${quoteToSOSalesOrderCount} (${quoteToSOPercentage}%)`}
            </div>
            <div className="text-xs font-medium text-gray-600">Quote → SO</div>
            <div className="text-xs text-gray-500">Target: {quoteToSOTargetPercentage}% • Achievement: {quoteToSOAchievementPercentage}% • Rating: {quoteToSORating}</div>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-orange-500 h-2 rounded-full" 
                style={{ width: `${Math.min(quoteToSOAchievementPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* SO → SI */}
          <div className="bg-red-50 p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {loadingQuoteToSO ? <Spinner className="w-6 h-6" /> : `${soToSIDeliveredCount} (${soToSIPercentage}%)`}
            </div>
            <div className="text-xs font-medium text-gray-600">SO → SI</div>
            <div className="text-xs text-gray-500">Target: {soToSITargetPercentage}% • Achievement: {soToSIAchievementPercentage}% • Rating: {soToSIRating}</div>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div 
                className="bg-red-500 h-2 rounded-full" 
                style={{ width: `${Math.min(soToSIAchievementPercentage, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* New Account Development */}
          <div className="bg-purple-50 p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {loadingNewAccount ? <Spinner className="w-6 h-6" /> : newAccountCount}
            </div>
            <div className="text-xs font-medium text-gray-600">New Account Dev.</div>
            <div className="text-xs text-gray-500">
              Target: {newAccountTarget} • Achievement: {newAccountPercentage}% • Rating: {newAccountRating}
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${Math.min(newAccountPercentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Conversion metrics chart */}
        <div className="w-full mt-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">
            Conversion Metrics
          </div>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="conversion" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
};
