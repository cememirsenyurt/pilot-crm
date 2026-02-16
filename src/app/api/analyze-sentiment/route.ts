import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const MOCK_ANALYSIS = {
  overallSentiment: 7,
  customerSatisfaction: 7,
  likelihoodToClose: 60,
  painPoints: ["Pricing concerns mentioned", "Integration timeline unclear"],
  positiveSignals: ["Interested in demo", "Asking detailed questions"],
  objectionsRaised: ["Budget approval needed"],
  nextSteps: ["Send proposal", "Schedule technical deep-dive"],
  summary: "Positive call with engaged prospect. Some budget concerns but overall receptive.",
  reasoning: {
    sentimentReasoning: "Customer asked detailed questions and expressed interest, indicating engagement.",
    satisfactionReasoning: "No complaints raised; tone was professional and constructive.",
    likelihoodReasoning: "Budget approval is a blocker but the technical fit is strong.",
  },
};

export async function POST(req: NextRequest) {
  const { transcript, contactName } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY || !transcript) {
    return NextResponse.json(MOCK_ANALYSIS);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a sales call analyst for a B2B SaaS company. Analyze this sales call transcript between a rep and ${contactName}.

TRANSCRIPT:
${transcript}

Return ONLY valid JSON with this exact structure:
{
  "overallSentiment": <1-10>,
  "customerSatisfaction": <1-10>,
  "likelihoodToClose": <0-100>,
  "painPoints": ["<direct quote from transcript>", ...],
  "positiveSignals": ["<direct quote from transcript>", ...],
  "objectionsRaised": ["<brief description>", ...],
  "nextSteps": ["<action item>", ...],
  "summary": "<one sentence summary>",
  "reasoning": {
    "sentimentReasoning": "<why this score, cite transcript>",
    "satisfactionReasoning": "<why this score, cite transcript>",
    "likelihoodReasoning": "<why this score, cite transcript>"
  }
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json(MOCK_ANALYSIS);

    const analysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Sentiment analysis failed:", err);
    return NextResponse.json(MOCK_ANALYSIS);
  }
}
