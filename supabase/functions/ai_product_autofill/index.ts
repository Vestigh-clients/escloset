import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://luxuriantgh.store"
const API_ENDPOINT = "aiplatform.googleapis.com"
const MODEL_ID = "gemini-3.1-flash-lite-preview"
const GENERATE_CONTENT_API = "streamGenerateContent"
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
}

type InlineImageInput = {
  data?: string
  mimeType?: string
}

type RequestBody = {
  product_name?: string
  category?: string
  image?: InlineImageInput
}

type GeminiChunk = {
  candidates?: Array<{
    finishReason?: string
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"])

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })

const parseStreamChunks = (rawText: string): GeminiChunk[] => {
  try {
    const parsed = JSON.parse(rawText) as unknown

    if (Array.isArray(parsed)) {
      return parsed as GeminiChunk[]
    }

    if (parsed && typeof parsed === "object") {
      return [parsed as GeminiChunk]
    }
  } catch {
    const lineChunks: GeminiChunk[] = []
    const normalizedLines = rawText
      .split("\n")
      .map((line) => line.trim())
      .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line))
      .filter((line) => Boolean(line) && line !== "[DONE]")

    for (const line of normalizedLines) {
      try {
        const parsed = JSON.parse(line) as unknown
        if (parsed && typeof parsed === "object") {
          lineChunks.push(parsed as GeminiChunk)
        }
      } catch {
        // Ignore non-JSON lines in stream format.
      }
    }

    if (lineChunks.length > 0) {
      return lineChunks
    }
  }

  throw new Error("Unsupported Gemini stream format")
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed",
    })
  }

  try {
    const body = (await req.json()) as RequestBody

    const productName = typeof body.product_name === "string" ? body.product_name.trim() : ""
    const category = typeof body.category === "string" ? body.category.trim() : ""
    const image = body.image

    if (!productName) {
      return jsonResponse(400, {
        success: false,
        message: "Product name is required",
      })
    }

    if (!GEMINI_API_KEY) {
      return jsonResponse(500, {
        success: false,
        message: "API key not configured",
      })
    }

    if (image?.mimeType && !allowedMimeTypes.has(image.mimeType)) {
      return jsonResponse(400, {
        success: false,
        message: "Unsupported image format. Use JPEG, PNG or WebP.",
      })
    }

    const hasImage =
      typeof image?.data === "string" &&
      image.data.trim() !== "" &&
      typeof image?.mimeType === "string" &&
      image.mimeType.trim() !== ""

    const parts: Array<Record<string, unknown>> = []

    parts.push({
      text: hasImage
        ? `You are a product copywriter for Luxuriant, a luxury fashion and hair care brand based in Ghana.

An image of the product has been provided. Use visual details from the image - texture, color, finish, packaging, and any visible product characteristics - to make the descriptions specific and accurate.
Do not invent details not visible in the image.

Product Name: ${productName}
${category ? `Category: ${category}` : ""}

Tone: elevated and editorial.
Reference points: Celine, The Row, Toteme.
Avoid generic words like "premium", "high quality", "luxurious".
Use Ghanaian lifestyle and climate context where relevant e.g. humidity, occasions, everyday luxury in Accra.`
        : `You are a product copywriter for Luxuriant, a luxury fashion and hair care brand based in Ghana.

No image provided. Generate content based on product name and category only.
Do not invent specific visual details like color or texture - keep descriptions accurate and sensory without being specific about appearance.

Product Name: ${productName}
${category ? `Category: ${category}` : ""}

Tone: elevated and editorial.
Reference points: Celine, The Row, Toteme.
Avoid generic words like "premium", "high quality", "luxurious".
Use Ghanaian lifestyle and climate context where relevant.`,
    })

    if (hasImage) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      })
    }

    const geminiRequest = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
        topP: 0.95,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            short_description: {
              type: "STRING",
            },
            full_description: {
              type: "STRING",
            },
            meta_title: {
              type: "STRING",
            },
            meta_description: {
              type: "STRING",
            },
            tags: {
              type: "ARRAY",
              items: { type: "STRING" },
            },
            benefits: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  icon: { type: "STRING" },
                  label: { type: "STRING" },
                  description: { type: "STRING" },
                },
              },
            },
            sku_suggestion: {
              type: "STRING",
            },
            weight_grams: {
              type: "NUMBER",
            },
          },
          required: [
            "short_description",
            "full_description",
            "meta_title",
            "meta_description",
            "tags",
            "benefits",
            "sku_suggestion",
            "weight_grams",
          ],
        },
        thinkingConfig: {
          thinkingLevel: "LOW",
        },
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "OFF",
        },
      ],
    }

    const geminiResponse = await fetch(
      `https://${API_ENDPOINT}/v1/publishers/google/models/${MODEL_ID}:${GENERATE_CONTENT_API}?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiRequest),
      },
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error("Gemini API error:", errorText)

      if (hasImage && errorText.toLowerCase().includes("image")) {
        return jsonResponse(400, {
          success: false,
          message: "Image could not be processed. Try AI Fill without the image.",
        })
      }

      return jsonResponse(500, {
        success: false,
        message: "AI service unavailable. Please try again.",
      })
    }

    const reader = geminiResponse.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()
    let rawText = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      rawText += decoder.decode(value, { stream: true })
    }
    rawText += decoder.decode()

    let chunks: GeminiChunk[]
    try {
      chunks = parseStreamChunks(rawText)
    } catch (error) {
      console.error("Failed to parse Gemini stream:", rawText)
      throw new Error(error instanceof Error ? error.message : "Failed to parse AI response")
    }

    // Concatenate text from ALL chunks
    let allGeneratedText = ""

    for (const chunk of chunks) {
      const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) {
        allGeneratedText += text
      }
    }

    if (!allGeneratedText) {
      throw new Error("No content in AI response")
    }

    let content: Record<string, unknown>
    try {
      content = JSON.parse(allGeneratedText) as Record<string, unknown>
    } catch {
      console.error(
        "Failed to parse concatenated content:",
        {
          fullText: allGeneratedText,
          chunkCount: chunks.length,
          lastChunkText: chunks[chunks.length - 1]
            ?.candidates?.[0]?.content?.parts?.[0]?.text,
        },
      )
      throw new Error("AI returned invalid content format")
    }

    return jsonResponse(200, {
      success: true,
      data: content,
      used_image: hasImage,
    })
  } catch (error) {
    console.error("ai_product_autofill error:", error)
    return jsonResponse(500, {
      success: false,
      message: "Something went wrong. Please try again.",
    })
  }
})
