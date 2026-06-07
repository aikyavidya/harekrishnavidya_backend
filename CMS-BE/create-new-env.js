const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

const envContent = `# Database Configuration
MONGO_URI=mongodb+srv://harekrishnamovementdigital_db_user:ZUlKBnZyR3u50Rbs@cluster0.hov6aes.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# Server Configuration
PORT=5021
NODE_ENV=production

# JWT Configuration
JWT_SECRET=sudhuhduihduehduheuheuheiheioejioeheiheioh
JWT_EXPIRE=30d

# Email Configuration — set EMAIL_HOST/PORT/USER/PASS for your SMTP provider (e.g. Brevo)
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=587
EMAIL_USER=noreply_donations@harekrishnavidya.org
EMAIL_PASS=RadhaKrishna#108

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_live_SRm4r1QeQbuoSE
RAZORPAY_KEY_SECRET=oeyTcLdrl0A8244Mb5PwxjBU

# Optional: Webhook Secret (if using Razorpay webhooks)
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# PayU Configuration
PAYU_KEY=moGVn9
PAYU_SALT=G6sMmmKwxt6HoTuyXsJewOLtC71JoC1A
PAYU_MODE=live

# URLs (used for PayU callbacks and redirects)
FRONTEND_URL=https://harekrishnavidya.org
BASE_URL=https://api.harekrishnavidya.org

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# CORS Configuration
CORS_ORIGIN=https://harekrishnavidya.org
`;

// Write the new .env file with UTF-8 encoding
fs.writeFileSync(envPath, envContent, 'utf8');

console.log('✅ New .env file created successfully!');
console.log('📝 All environment variables are properly formatted');

// Verify the content
const newContent = fs.readFileSync(envPath, 'utf8');
console.log('\n🔍 New .env file content:');
console.log(newContent);
