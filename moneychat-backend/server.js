const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();

// Content Security Policy 설정
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src *"
    );
    next();
});

// JSON 파싱
app.use(express.json());

// CORS 설정
app.use(cors({
    origin: ['https://moneychat-3155a.web.app', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// API 요청 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Request body:', req.body);
    next();
});

// OpenAI 설정
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 루트 경로 핸들러
app.get('/', (req, res) => {
    res.json({
        message: 'Server is running',
        status: 'ok',
        timestamp: new Date()
    });
});

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        apiKey: !!process.env.OPENAI_API_KEY
    });
});

// 메시지 분석 엔드포인트
app.post('/api/analyze-message', async (req, res) => {
    try {
        // API 키 확인
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        const { message } = req.body;
        console.log('Analyzing message:', message);

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: `당신은 지출 내역을 분석하는 AI 도우미입니다. 
       사용자의 메시지에서 지출 관련 정보를 추출하고, 주제와 카테고리로 정리해주세요.
       
       카테고리 정리 규칙:
       1. 원본 주제는 사용자가 입력한 실제 지출 항목 (예: 나이키 신발, 아메리카노)
       2. 카테고리는 더 넓은 분류 (예: 패션, 카페)
       3. 기본 카테고리: 식사, 카페, 교통, 패션, 문화, 의료, 교육, 생활 등
       
       응답은 다음 JSON 형식으로 제공:
       {
         "hasExpense": boolean,
         "amount": number | null,
         "subject": string | null,
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
        console.error('Error details:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
- 이번 달 총 지출: ${total.toLocaleString()}원
- 일일 평균 지출: ${Math.round(dailyAverage).toLocaleString()}원
- 경과 일수: ${daysInMonth}일
- 카테고리별 지출:
${Object.entries(byCategory)
    .map(([category, amount]) => `  - ${category}: ${amount.toLocaleString()}원`)
    .join('\n')}

다음 사항을 포함하여 간단히 각 주제에 대해 1~2줄 정도로 분석해주세요:
1. 현재 지출 패턴의 특징
2. 개선이 필요한 부분이 있다면 구체적인 제안
`
            }
        ];

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

// 서버 시작
const PORT = process.env.PORT || 10000;
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