# WHISP – College Chatroom App  

WHISP is a lightweight, mobile-first web chat application built for college students.  
It provides a private public chatroom where only verified users with custom IDs and passwords can join.  
The project uses **Supabase** for authentication, SQL database, and media storage.  

---

## ✨ Features (V1)  
- Public chatroom for all verified users  
- Text messaging  
- Image sharing with captions  
- Usernames and profile pictures  
- Online users count  
- Mobile-friendly, minimal UI  

---

## 🛠️ Tech Stack  
- **Frontend:** HTML, CSS, JavaScript  
- **Backend / Database:** Supabase (Auth + SQL + Storage)  

---

## 📂 Database Design  
### Users Table  
- `id` (Primary key)  
- `username`  
- `password` (plain for now)  
- `dp_link` (profile picture URL)  

### Messages Table  
- `id` (Primary key)  
- `sender_id` (foreign key → users.id)  
- `text`  
- `image_url`  
- `timestamp`  

### Storage  
- Supabase bucket for images  

---

## ⚙️ How It Works  
1. Student requests account via WhatsApp to admin.  
2. Admin creates user record in Supabase with username, ID, password, and DP link.  
3. User logs in using their credentials.  
4. Messages (text or image) are stored in Supabase and displayed in real time in the chat UI.  

---

## 🚀 Future Features (V2)  
- Private one-to-one chats  
- Emojis and reactions  
- Push notifications  
- Polls / pinned messages  

---

## 📸 UI Preview  
*(Add screenshots here after setting up UI)*  

---

## 📦 Setup Instructions  
1. Clone the repo:  
   ```bash
   git clone https://github.com/yourusername/whisp.git
   cd whisp


   All Rights Reserved

Copyright (c) 2025 Awais, MALIK SOFTWEBS

This software and its source code are the property of Awais and MALIK SOFTWEBS.
Unauthorized copying, modification, distribution, or use of this software,
via any medium, is strictly prohibited.

The software is provided for personal or organizational use only,
without permission to redistribute or make derivative works.

For inquiries about licensing, contact: awais.112191@gmail.com

> Goodbye 👋🫂
