"use client";

import "@copilotkit/react-ui/styles.css";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotSidebar
        labels={{
          title: "Sales Copilot",
          initial:
            "Hey! I'm your AI sales assistant. I can see your full pipeline — ask me about accounts, meeting prep, deal health, or tell me to move deals and add notes.",
        }}
        defaultOpen={true}
        clickOutsideToClose={false}
        instructions={[
          "You are PilotCRM's AI sales assistant. You have FULL real-time access to the CRM pipeline data — all accounts, deals, call records, activities, and pipeline statistics are available to you.",
          "",
          "CRITICAL RULES:",
          "1. ALWAYS answer using specific company names, dollar amounts, percentages, and dates from the CRM data. Never be vague.",
          "2. When the user asks to SEE, SHOW, VISUALIZE, CHART, GRAPH, or PLOT anything — ALWAYS call the createVisualization tool. YOU decide the chart type (funnel, bar_chart, comparison, scorecard, progress) and YOU compute the data points from the CRM data. Never just describe what you would show — actually render it.",
          "3. When the user asks to modify deals, move stages, add notes, update likelihood, or flag risks — call the appropriate action tool IMMEDIATELY. Do not ask for confirmation unless it is a closed_won stage change.",
          "4. When asked for meeting prep or account details, use getAccountBrief.",
          "5. You can answer ANY free-form question about the pipeline, accounts, deals, activities, sentiment, and call history because you can see all the data.",
          "6. Never say 'I would...' or 'I can...' or 'Let me set up...' — just DO it by calling the tool.",
          "7. If the user asks for something visual and you are unsure which chart type, default to bar_chart.",
          "",
          "AVAILABLE VISUALIZATION TYPES for createVisualization:",
          "- funnel: Tapered funnel visualization (great for pipeline stages, conversion flows)",
          "- bar_chart: Horizontal bar chart (great for comparing values across categories)",
          "- comparison: Side-by-side cards (great for comparing 2-4 accounts or metrics)",
          "- scorecard: Big number KPI cards (great for showing key metrics at a glance)",
          "- progress: Progress bars (great for showing completion or likelihood percentages)",
        ].join("\n")}
      >
        {children}
      </CopilotSidebar>
    </CopilotKit>
  );
}
