const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config(); // 환경 변수 로드

// Express 애플리케이션 생성
const app = express();

// Content Security Policy 설정
// XSS 공격 방지를 위한 보안 헤더 설정
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src *"
    );
    next();
});

// JSON 파싱 미들웨어 설정
app.use(express.json());

// CORS 설정
// 허용된 도메인과 메서드 정의
app.use(cors({
    origin: ['https://moneychat-3155a.web.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],  // OPTIONS 메서드는 preflight 요청에 필요
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true // 인증 정보 허용
}));

// API 요청 로깅 미들웨어
// 모든 요청에 대한 시간과 내용을 로그로 기록
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Request body:', req.body);
    next();
});

// OpenAI API 클라이언트 초기화
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 서버 상태 확인을 위한 루트 경로 핸들러
app.get('/', (req, res) => {
    res.json({
        message: 'Server is running',
        status: 'ok',
        timestamp: new Date()
    });
});

// 서버 헬스 체크 엔드포인트
// 주소창 마지막에 /health 추가해서 확인
// API 키 설정 여부도 함께 확인
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        apiKey: !!process.env.OPENAI_API_KEY
    });
});

// 사용자 메시지 분석 엔드포인트
// 지출 관련 정보 추출 및 분석
app.post('/api/analyze-message', async (req, res) => {
    console.log('Received request to /api/analyze-message');
    console.log('Request body:', req.body);
    try {
        // OpenAI API 키 존재 여부 확인
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        const { message } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Message is required and must be a non-empty string'
            });
        }

        console.log('Analyzing message:', message);

        // GPT-3.5 모델을 사용하여 메시지 분석
        // 원하는 챗봇의 기능 프롬프트 작성
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: `당신은 친근하고 도움이 되는 챗봇 AI 도우미입니다. 
                사용자의 메시지에서 지출 관련 정보를 추출하고, 주제와 카테고리로 정리해주세요. 또한, 다른 일상적인 대화에도 자연스럽게 응답할 수 있습니다.
                
                카테고리 정리 규칙:
                1. 원본 주제는 사용자가 입력한 실제 지출 항목 (예: 나이키 신발, 아메리카노)
                2. 카테고리는 더 넓은 분류 (예: 패션, 카페)
                3. 기본 카테고리: 식사, 카페, 교통, 패션, 문화, 의료, 교육, 생활 등

                일상적인 대화 규칙:
                1. 자연스럽고 친근한 톤으로 응답
                2. 대화 맥락을 고려한 적절한 답변 제공
                3. 가능한 한 지출 관리나 재무 관련 주제로 자연스럽게 연결
                4. 사용자의 메시지에 지출 관련 정보가 포함되지 않아도 자연스러운 답변 제공
                
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
            response_format: { type: "json_object" } // JSON 형식으로 응답 요청
        });

        // 분석 결과 파싱 및 응답
        const analysis = JSON.parse(response.choices[0].message.content);
        console.log('Analysis result:', analysis);

        res.json(analysis);
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// 지출 분석 엔드포인트
// 월별 지출 패턴 분석 및 피드백 제공
app.post('/api/analyze-spending', async (req, res) => {
    try {
        console.log('Request received:', req.body);
        // 필요한 데이터 추출
        const { total, dailyAverage, byCategory, daysInMonth } = req.body;

        // 필수 데이터 검증
        if (!total && total !== 0) {
            return res.status(400).json({ error: 'Total amount is required' });
        }

        // GPT 모델에 전달할 메시지 구성
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
            // GPT 모델을 사용하여 지출 분석 및 피드백 생성
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: messages,
                temperature: 0.7, // 응답의 창의성 조절
                max_tokens: 500, // 응답 길이 제한
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            });

            // 분석 결과 응답
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
        });
    }
});

// 서버 시작 및 포트 설정
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Environment:', {
        nodeEnv: process.env.NODE_ENV,
        hasApiKey: !!process.env.OPENAI_API_KEY
    });
});

// 전역 에러 핸들러 설정
// 예상치 못한 에러 처리
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// 처리되지 않은 Promise 거부 처리
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});