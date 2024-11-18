const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI 클라이언트 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 메시지 분석 엔드포인트
app.post('/api/analyze-message', async (req, res) => {
    try {
        const { message } = req.body;
        console.log('Analyzing message:', message);

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: `당신은 지출 내역을 분석하는 AI 도우미입니다. 
        사용자의 메시지에서 지출 관련 정보를 추출하고, 기본 카테고리로 정리해주세요.
        
        카테고리 정리 규칙:
        1. "~으로", "~에서", "~에", "~로" 등의 조사는 제거
        2. 비슷한 의미의 카테고리는 하나로 통합 (예: "저녁으로", "저녁식사" → "저녁")
        3. 기본 카테고리: 아침, 점심, 저녁, 간식, 카페, 교통, 쇼핑, 문화, 의료, 교육 등
        
        응답은 다음 JSON 형식으로 제공:
        {
          "hasExpense": boolean,
          "amount": number | null,
          "category": string | null,
          "feedback": string
        }`
            }, {
                role: "user",
                content: message
            }],
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(response.choices[0].message.content);
        console.log('Analysis result:', analysis);

        res.json(analysis);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// 지출 분석 엔드포인트
app.post('/api/analyze-spending', async (req, res) => {
    try {
        console.log('Request received:', req.body);
        const { total, dailyAverage, byCategory, daysInMonth } = req.body;

        if (!total && total !== 0) {
            return res.status(400).json({ error: 'Total amount is required' });
        }

        const messages = [
            {
                role: "system",
                content: "당신은 친근하고 전문적인 재무 상담사입니다. 사용자의 지출을 분석하고 실용적인 조언을 제공해주세요."
            },
            {
                role: "user",
                content: `
현재 사용자의 지출 현황을 분석해주세요:
• 이번 달 총 지출: ${total.toLocaleString()}원
• 일일 평균 지출: ${Math.round(dailyAverage).toLocaleString()}원
• 경과 일수: ${daysInMonth}일
• 카테고리별 지출:
${Object.entries(byCategory)
                        .map(([category, amount]) => `  - ${category}: ${amount.toLocaleString()}원`)
                        .join('\n')}

다음 사항을 포함하여 분석해주세요:
1. 현재 지출 패턴의 특징
2. 개선이 필요한 부분이 있다면 구체적인 제안
3. 잘하고 있는 부분에 대한 격려
`
            }
        ];

        console.log('Preparing OpenAI API call with messages:', messages);

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            });

            console.log('OpenAI API Response:', completion.choices[0]);

            res.json({
                feedback: completion.choices[0].message.content
            });
        } catch (openaiError) {
            console.error('OpenAI API Error:', openaiError);
            throw new Error(`OpenAI API Error: ${openaiError.message}`);
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            error: 'An error occurred while analyzing spending',
            message: error.message,
            type: error.type,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        apiKey: !!process.env.OPENAI_API_KEY
    });
});

// 서버 시작
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Environment:', {
        nodeEnv: process.env.NODE_ENV,
        hasApiKey: !!process.env.OPENAI_API_KEY
    });
});

// 예상치 못한 에러 처리
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});