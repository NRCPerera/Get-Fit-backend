# Gym Management System - Backend API

A comprehensive backend API for a gym management system built with Node.js, Express, and MongoDB.

## Features

- **User Authentication**: JWT-based authentication with role-based access control
- **User Management**: Support for members, instructors, and admin roles
- **Exercise Library**: CRUD operations for exercises with categories and difficulty levels
- **Training Schedules**: Create and manage workout schedules
- **Nutrition Plans**: Create and assign nutrition plans
- **Payment Integration**: Stripe payment processing
- **Medical Forms**: Health information collection and management
- **Reviews & Ratings**: Instructor rating system
- **Notifications**: Real-time notifications via Firebase
- **File Uploads**: Local file storage for image/video uploads

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Payments**: Stripe
- **File Storage**: Local file system
- **Notifications**: Firebase Cloud Messaging
- **Email**: Nodemailer
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000

   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/Get-Fit-DB

   # JWT Configuration (REQUIRED)
   # Generate strong secrets: openssl rand -base64 32
   JWT_SECRET=change_this_secret_key_min_32_characters
   JWT_REFRESH_SECRET=change_this_refresh_secret_key_min_32_characters
   JWT_EXPIRE=15m
   JWT_REFRESH_EXPIRE=7d

   # Stripe Configuration (Optional - for payments)
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

   # Email Configuration (Optional - for email verification and password reset)
   # For Gmail: Use App Password (not regular password)
   # Enable 2FA and generate App Password at: https://myaccount.google.com/apppasswords
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your_app_password

   # Firebase Configuration (Optional - for push notifications)
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----\n"

   # Client Configuration
   CLIENT_URL=http://localhost:3000
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

   # Rate Limiting Configuration
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

4. Update the `.env` file with your configuration values

5. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See the keys above for all required environment variables.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Forgot password
- `POST /api/v1/auth/reset-password` - Reset password

### Users
- `GET /api/v1/users/me` - Get user profile
- `PUT /api/v1/users/me` - Update user profile
- `POST /api/v1/users/me/profile-picture` - Upload profile picture
- `POST /api/v1/users/me/change-password` - Change password
- `DELETE /api/v1/users/me` - Deactivate account

### Exercises
- `GET /api/v1/exercises` - Get all exercises
- `GET /api/v1/exercises/:id` - Get exercise by ID
- `POST /api/v1/exercises` - Create exercise (Admin only)
- `PUT /api/v1/exercises/:id` - Update exercise
- `DELETE /api/v1/exercises/:id` - Delete exercise

### Training Schedules
- `POST /api/v1/schedules` - Create schedule
- `GET /api/v1/schedules/me` - Get my schedules
- `GET /api/v1/schedules/templates` - Get templates
- `GET /api/v1/schedules/:id` - Get schedule by ID
- `PUT /api/v1/schedules/:id` - Update schedule
- `DELETE /api/v1/schedules/:id` - Delete schedule
- `POST /api/v1/schedules/:id/assign` - Assign schedule
- `POST /api/v1/schedules/:id/share` - Share as template

### Instructors
- `GET /api/v1/instructors` - Get all instructors
- `GET /api/v1/instructors/:id` - Get instructor by ID
- `PUT /api/v1/instructors/me` - Update my instructor profile
- `GET /api/v1/instructors/me/stats` - Get my instructor stats
- `GET /api/v1/instructors/me/clients` - Get my clients
- `POST /api/v1/instructors/me/availability` - Update availability
- `POST /api/v1/instructors/apply` - Become instructor

### Payments
- `POST /api/v1/payments/create-intent` - Create payment intent
- `POST /api/v1/payments/confirm` - Confirm payment
- `GET /api/v1/payments/history` - Get my payment history
- `GET /api/v1/payments/earnings` - Get instructor earnings
- `POST /api/v1/payments/webhook` - Stripe webhook
- `POST /api/v1/payments/:paymentId/refund` - Refund payment (admin)

### Medical
- `POST /api/v1/medical` - Create medical form
- `GET /api/v1/medical/me` - Get my medical form
- `PUT /api/v1/medical/me` - Update my medical form
- `GET /api/v1/medical/client/:userId` - Instructor view client form

### Reviews
- `POST /api/v1/reviews` - Create review
- `GET /api/v1/reviews/me` - Get my reviews
- `GET /api/v1/reviews/instructor/:instructorId` - Get instructor reviews
- `PUT /api/v1/reviews/:id` - Update review
- `DELETE /api/v1/reviews/:id` - Delete review

### Admin
- `GET /api/v1/admin/dashboard` - Dashboard stats
- `GET /api/v1/admin/users` - List users
- `GET /api/v1/admin/users/:id` - User details
- `POST /api/v1/admin/users/:id/suspend` - Suspend user
- `POST /api/v1/admin/users/:id/activate` - Activate user
- `GET /api/v1/admin/instructors` - List instructors
- `POST /api/v1/admin/instructors/:userId/approve` - Approve instructor
- `GET /api/v1/admin/payments` - List payments
- `GET /api/v1/admin/exercises` - List exercises
- `GET /api/v1/admin/analytics` - Analytics

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middlewares/     # Custom middlewares
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic services
├── utils/           # Utility functions
├── validators/       # Input validation
├── app.js           # Express app setup
└── server.js        # Server entry point
```

## Development

- **Start development server**: `npm run dev`
- **Start production server**: `npm start`
- **Lint code**: `npm run lint`

## License

ISC

