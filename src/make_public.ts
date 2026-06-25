import dotenv from 'dotenv';
dotenv.config();

const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const REPO = 'hungdc-smartosc/mcp-demo';

async function makePublic() {
  if (!TOKEN) {
    console.error('❌ Lỗi: Không tìm thấy biến môi trường GITHUB_PERSONAL_ACCESS_TOKEN.');
    console.error('Vui lòng kiểm tra lại xem shell hiện tại đã load được biến này chưa (chạy: echo $GITHUB_PERSONAL_ACCESS_TOKEN).');
    process.exit(1);
  }

  console.log(`🔄 Đang gửi yêu cầu chuyển đổi repo ${REPO} sang Public...`);
  
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${TOKEN.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Antigravity-Agent'
      },
      body: JSON.stringify({ private: false })
    });

    const data = await response.json() as any;

    if (response.ok) {
      console.log('✅ Thành công! Repository của bạn hiện đã được chuyển sang chế độ PUBLIC.');
      console.log(`🔗 Link: ${data.html_url}`);
    } else {
      console.error(`❌ Thất bại: ${response.status} - ${data.message}`);
      if (data.message === 'Bad credentials') {
        console.error('👉 Token của bạn có thể đã hết hạn hoặc không chính xác.');
      }
    }
  } catch (error: any) {
    console.error('❌ Lỗi kết nối:', error.message);
  }
}

makePublic();
