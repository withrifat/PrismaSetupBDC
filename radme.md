import pypandoc

content = r'''# Express + Prisma + MongoDB Atlas — Setup Guide

এই guide-এ **Express.js + ES Modules (`import/export`) + dotenv + Nodemon + Prisma 6 + MongoDB Atlas** দিয়ে API project তৈরি করা হয়েছে।

> **Version note:** এই guide Prisma `6.19.3` ব্যবহার করে, কারণ এই project-এ MongoDB connector ব্যবহার করা হচ্ছে। Prisma-এর version পরিবর্তনের আগে MongoDB compatibility যাচাই করবে।

## 1. Requirements

- Node.js এবং npm ইনস্টল থাকতে হবে
- MongoDB Atlas account ও cluster থাকতে হবে
- VS Code / অন্য code editor
- Postman (API test করার জন্য)

Version check:

```bash
node -v
npm -v
```

## 2. Project তৈরি

```bash
mkdir express-api
cd express-api
npm init -y
```

## 3. Packages install

```bash
npm i express dotenv @prisma/client@6.19.3
npm i -D nodemon prisma@6.19.3
```

ES Modules এবং scripts সেট করো:

```bash
npm pkg set type=module
npm pkg set scripts.dev="nodemon src/server.js"
npm pkg set scripts.start="node src/server.js"
```

Folder তৈরি করো:

```bash
mkdir src
npx prisma init --datasource-provider mongodb
```

`prisma init` সাধারণত `prisma/schema.prisma` এবং `.env` তৈরি করবে।

## 4. MongoDB Atlas connection

MongoDB Atlas-এ:

1. একটি cluster তৈরি করো।
2. **Database Access** থেকে database user তৈরি করো।
3. **Network Access**-এ নিজের IP allow করো।
4. **Connect → Drivers** থেকে connection string কপি করো।

Project root-এর `.env` ফাইলে:

```env
PORT=5000
DATABASE_URL="mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/mydb?retryWrites=true&w=majority"
```

`USERNAME`, `PASSWORD`, `CLUSTER` নিজের Atlas details দিয়ে বদলাবে। Password-এ `@`, `#`, `/`-এর মতো special character থাকলে URI encoding লাগতে পারে।

**Security:**
- `.env` কখনো GitHub-এ commit করবে না।
- `.gitignore`-এ এগুলো রাখো:

```gitignore
node_modules/
.env
```

## 5. Prisma schema

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Student {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  email     String   @unique
  phone     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("students")
}
```

**Schema tips:**
- Model name `User`, `Student`-এর মতো PascalCase রাখো।
- MongoDB ObjectId field-এর জন্য `@id @default(auto()) @map("_id") @db.ObjectId` ব্যবহার করো।
- Optional field-এর শেষে `?` দাও, যেমন `phone String?`।
- `@unique` শুধু সত্যিই unique হওয়া দরকার এমন field-এ দাও।
- `@@map("users")` ও `@@map("students")` collection-এর নাম নির্ধারণ করে।
- `updatedAt` চাইলে `DateTime @updatedAt` রাখো।

## 6. Prisma commands

প্রথমবার schema প্রস্তুত করার পর:

```bash
npx prisma validate
npx prisma generate
npx prisma db push
```

কাজগুলো:
- `validate` — schema syntax ও configuration যাচাই করে।
- `generate` — schema অনুযায়ী Prisma Client তৈরি করে।
- `db push` — schema MongoDB-র সঙ্গে sync করে এবং প্রয়োজনীয় index তৈরি করতে পারে। এটি migration history তৈরি করে না; schema change-এর আগে গুরুত্বপূর্ণ data backup রাখো।
- `npx prisma studio` — browser-এ database records দেখার ও manage করার UI চালু করে, সাধারণত `http://localhost:5555`-এ।

Model/schema বদলালে প্রয়োজন অনুযায়ী আবার `generate` ও `db push` চালাও। শুধু Express route/code বদলালে সাধারণত এগুলো লাগবে না।

## 7. Express API

`src/server.js`:

```js
import "dotenv/config";
import express from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Server + database health check
app.get("/", async (req, res) => {
  try {
    await prisma.$connect();
    await prisma.user.count();

    res.json({
      success: true,
      server: "running",
      database: "connected",
    });
  } catch (error) {
    console.error("Database connection error:", error.message);
    res.status(500).json({
      success: false,
      server: "running",
      database: "disconnected",
    });
  }
});

// Create user
app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (
      typeof name !== "string" || !name.trim() ||
      typeof email !== "string" || !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
      },
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    console.error("Create user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Fetch users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Close Prisma connection cleanly when process stops
async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

## 8. Server চালানো

```bash
npm run dev
```

Production-style local start:

```bash
npm start
```

## 9. Postman দিয়ে test

### A. Server এবং database connection check

- Method: `GET`
- URL: `http://localhost:5000/`

Expected response:

```json
{
  "success": true,
  "server": "running",
  "database": "connected"
}
```

### B. User save

- Method: `POST`
- URL: `http://localhost:5000/api/users`
- **Body → raw → JSON**

```json
{
  "name": "Rifat Hossain",
  "email": "rifat.test@example.com"
}
```

সফল হলে status `201 Created` হবে। একই email আবার পাঠালে `409 Conflict` হবে।

### C. Saved users দেখো

- Method: `GET`
- URL: `http://localhost:5000/api/users`

Response-এর `data` array-তে saved users থাকবে।

### D. Prisma Studio

নতুন terminal-এ চালাও:

```bash
npx prisma studio
```

Browser-এ `http://localhost:5555` খোলো। `mydb` database-এর `users` collection দেখতে Atlas Data Explorer-ও ব্যবহার করতে পারো।

## 10. Final folder structure

```text
express-api/
├── node_modules/
├── prisma/
│   └── schema.prisma
├── src/
│   └── server.js
├── .env
├── .gitignore
├── package.json
└── package-lock.json
```

`prisma.config.ts` থাকলে

এই guide-এর Prisma 6 setup-এ `schema.prisma`-এর `url = env("DATABASE_URL")` ব্যবহার করা হয়েছে। তোমার CLI যদি `prisma.config.ts` লোড করে, তাহলে সেই config-এর content-ও environment loading-এ প্রভাব ফেলতে পারে। বর্তমান setup-এ CLI যদি schema validate ও `db push` সফলভাবে চালায়, তাহলে config ও VS Code extension-এর diagnostic আলাদা করে যাচাই করো; একই সঙ্গে Prisma 6 ও Prisma 7-এর configuration উদাহরণ মিশিয়ে ফেলো না।

## Troubleshooting

- **Authentication failed:** Atlas username/password ঠিক আছে কি না যাচাই করো।
- **Can't reach database server:** Atlas Network Access-এ IP allow করা আছে কি না দেখো।
- **Duplicate email:** প্রতিটি user-এর জন্য আলাদা email ব্যবহার করো।
- **Prisma Client/schema mismatch:** চালাও:

  ```bash
  npx prisma validate
  npx prisma generate
  ```

- **Version যাচাই:**

  ```bash
  npx prisma -v
  npm ls prisma @prisma/client
  ```

প্রতিটি command-এর output error দেখালে সেটি দেখে পরের ধাপ ঠিক করো; error না দেখে বারবার package update কোরো না।
'''
output_path = "/mnt/data/README.md"
pypandoc.convert_text(content, "md", format="md", outputfile=output_path, extra_args=["--standalone"])
print(f"Created {output_path}")
