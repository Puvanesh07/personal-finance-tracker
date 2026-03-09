import type { Handler } from "@netlify/functions"

const NOTION_API_URL = "https://api.notion.com/v1/pages"
const NOTION_VERSION = "2022-06-28"

type InvestmentPayload = {
  id: string
  name: string
  type: string
  investedAmount: number
  expectedGain: number
  createdAt: string
  interestRate?: number
  durationMonths?: number
}

type SyncRequestBody = {
  investments: InvestmentPayload[]
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed",
    }
  }

  try {
    const token = process.env.NOTION_TOKEN
    const databaseId = process.env.NOTION_DATABASE_ID

    if (!token || !databaseId) {
      return {
        statusCode: 500,
        body: "Notion env vars NOTION_TOKEN / NOTION_DATABASE_ID are not set",
      }
    }

    const body: SyncRequestBody = event.body
      ? JSON.parse(event.body)
      : { investments: [] }

    if (!body.investments || body.investments.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, count: 0 }),
      }
    }

    await Promise.all(
      body.investments.map(async (inv) => {
        const properties: Record<string, any> = {
          Name: {
            title: [
              {
                text: {
                  content: inv.name,
                },
              },
            ],
          },

          "Investment type": {
            select: {
              name: inv.type,
            },
          },

          "Amount invested": {
            number: inv.investedAmount,
          },

          "Expected gain": {
            number: inv.expectedGain,
          },

          "Date added": {
            date: {
              start: inv.createdAt,
            },
          },
        }

        if (inv.interestRate != null) {
          properties["Interest Rate"] = {
            number: inv.interestRate,
          }
        }

        if (inv.durationMonths != null) {
          properties["Duration"] = {
            number: inv.durationMonths,
          }
        }

        const res = await fetch(NOTION_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          console.error("Notion API Error:", res.status, text)
          throw new Error(`Notion API error ${res.status}: ${text}`)
        }
      })
    )

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        count: body.investments.length,
      }),
    }
  } catch (err: any) {
    console.error("Function error:", err)

    return {
      statusCode: 500,
      body: err?.message || "Unknown error",
    }
  }
}