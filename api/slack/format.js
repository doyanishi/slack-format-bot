import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channel_id, user_id, text } = req.body;
  
  // 即座にレスポンス（Slackの3秒制限対応）
  res.status(200).json({ 
    response_type: 'in_channel',
    text: '構造化中...' 
  });

  try {
    // 最新メッセージ取得
    const history = await slack.conversations.history({
      channel: channel_id,
      limit: 5
    });

    const userMessages = history.messages.filter(msg => 
      msg.user === user_id && !msg.bot_id
    );

    if (userMessages.length === 0) {
      return;
    }

    const latestMessage = userMessages[0];

    // OpenAIで構造化
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "system",
        content: "以下の文章を、ビジネスシーンに適した丁寧で構造化された文章に変換してください。要点を整理し、適切な敬語を使用してください。"
      }, {
        role: "user",
        content: latestMessage.text
      }],
      max_tokens: 500,
      temperature: 0.3
    });

    const formattedText = response.choices[0].message.content;

    // 元メッセージ削除
    await slack.chat.delete({
      channel: channel_id,
      ts: latestMessage.ts
    });

    // 構造化版投稿
    await slack.chat.postMessage({
      channel: channel_id,
      text: formattedText,
      username: 'あなた（構造化済み）',
      icon_emoji: ':memo:'
    });

  } catch (error) {
    console.error('Error:', error);
    
    await slack.chat.postMessage({
      channel: channel_id,
      text: 'エラーが発生しました。もう一度お試しください。',
      user: user_id
    });
  }
}