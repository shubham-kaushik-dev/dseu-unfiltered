import User from '../models/User.js';
import LiveChatMessage from '../models/LiveChatMessage.js';
import Confession from '../models/Confession.js';
import Meme from '../models/Meme.js';
import Poll from '../models/Poll.js';

// SVG generator helper for meme illustrations
function getMemeSvgUrl(topText, bottomText, color1 = '#8b5cf6', color2 = '#06b6d4') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="#18181b" />
    <rect x="20" y="20" width="560" height="360" rx="15" fill="url(#grad)" opacity="0.15" stroke="url(#grad)" stroke-width="2" />
    <text x="50%" y="35%" font-family="'Inter', system-ui, sans-serif" font-size="28" fill="#f4f4f5" text-anchor="middle" font-weight="800" letter-spacing="1">${topText.toUpperCase()}</text>
    <circle cx="300" cy="200" r="40" fill="url(#grad)" opacity="0.8" />
    <text x="300" y="212" font-family="'Inter', system-ui, sans-serif" font-size="36" fill="#18181b" text-anchor="middle" font-weight="900">⚡</text>
    <text x="50%" y="70%" font-family="'Inter', system-ui, sans-serif" font-size="24" fill="#a1a1aa" text-anchor="middle" font-weight="600">${bottomText}</text>
  </svg>`;
  
  // Encode safely for data URL
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export async function seedDatabase() {
  try {
    // Check if we already have users or data. If so, don't seed.
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already populated. Skipping seeding.');
      return;
    }

    console.log('Seeding mock data for DSEU Unfiltered...');

    // 1. Create a set of Mock Users
    const mockUserNames = [
      'Sleepy Panda', 'Arctic Fox', 'Coffee Bean', 'Blue Ocean', 'Night Owl', 
      'Mango Slice', 'Thunder Wolf', 'Fuzzy Otter', 'Neon Badger', 'Cosmic Tiger',
      'Lazy Rabbit', 'Clever Penguin', 'Mighty Panther', 'Chill Koala', 'Swift Eagle'
    ];

    const seededUsers = [];
    for (let i = 0; i < mockUserNames.length; i++) {
      const user = await User.create({
        browserToken: `mock-token-${i + 1}-${Math.random().toString(36).substring(2, 8)}`,
        displayName: mockUserNames[i],
        campus: 'DSEU',
        lastActive: new Date()
      });
      seededUsers.push(user);
    }

    console.log(`Seeded ${seededUsers.length} mock users.`);

    // Helper to get random user
    const getRandomUser = () => seededUsers[Math.floor(Math.random() * seededUsers.length)];

    // 2. Seed 20 Fictional Confessions
    const confessionsText = [
      "Confession: I've been using the canteen's Wi-Fi to download series instead of attending lectures. Sorry, not sorry.",
      "I still don't know where the Lab 3 is, and at this point, I am too afraid to ask anyone.",
      "I pretended to be sick to skip a presentation, and now my group mates think I have a chronic illness.",
      "That moment when you make eye contact with your professor in the metro. Absolute silent awkwardness.",
      "To the person who took my blue pen from the library table: please return it, it has sentimental value (it cost 5 rupees).",
      "I spent the entire semester thinking a guy in my class was named Rohan. Today I found out his name is Rahul.",
      "I actually enjoy the canteen's coffee. There, I said it. Downvote me all you want.",
      "I submit ChatGPT generated assignments, but I rewrite them in my own bad handwriting so it looks authentic.",
      "I haven't opened my reference books once this semester. They are basically expensive room decor.",
      "To the girl in the red hoodie who sits in the front row: your laughs during the boring lecture make my day.",
      "I accidentally submitted my meme folder instead of my python project on the portal. Still waiting for the grade.",
      "Our college lift is a portal to another dimension. It takes 10 minutes to move two floors.",
      "I attend lectures just for the biometric attendance, then slide out the back door when the teacher turns around.",
      "Who else sits in the library just to sleep under the AC? It is the best nap spot on campus.",
      "I told my parents that I am staying late for 'lab work'. I am actually just playing Valorant in the campus hostel room.",
      "I lost my ID card on the first day, and I've been showing the security guard a picture of a random card for 3 months.",
      "The canteen samosa has more potato than my brain has knowledge right now.",
      "I spent an hour preparing a cheat sheet, only to realize the exam is open-book. I played myself.",
      "To whoever is playing loud Punjabi music in the parking lot: please share your playlist, it is fire.",
      "I still have no idea what my minor project is about, and the submission is next Monday. Send help!"
    ];

    const emojiReactions = ['❤️', '🔥', '😂', '😢', '😮'];
    const confessions = [];

    for (let i = 0; i < confessionsText.length; i++) {
      // Setup some random reactions
      const reactionsMap = new Map();
      emojiReactions.forEach(emoji => {
        // Randomly assign some mock user tokens as reactors
        const reactorCount = Math.floor(Math.random() * 6);
        const reactors = [];
        for (let r = 0; r < reactorCount; r++) {
          reactors.push(getRandomUser().browserToken);
        }
        reactionsMap.set(emoji, reactors);
      });

      // Setup some random comments
      const comments = [];
      const commentCount = Math.floor(Math.random() * 4); // 0-3 comments
      for (let c = 0; c < commentCount; c++) {
        const commentTexts = [
          "Bro, same here! 😂",
          "This is literally me every Monday.",
          "Wait, does Lab 3 even exist?",
          "Relatable level 9999",
          "Respect +++ for this post",
          "Please don't tell the HOD",
          "Which campus is this? Okhla or Dwarka?"
        ];
        comments.push({
          text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
          sender: getRandomUser()._id,
          createdAt: new Date(Date.now() - Math.random() * 10000000)
        });
      }

      const confession = await Confession.create({
        text: confessionsText[i],
        sender: getRandomUser()._id,
        campus: 'DSEU',
        reactions: reactionsMap,
        comments: comments,
        createdAt: new Date(Date.now() - i * 3600000) // hourly intervals
      });
      confessions.push(confession);
    }
    console.log(`Seeded ${confessions.length} confessions.`);

    // 3. Seed 7 Fictional Memes (with colorful SVGs)
    const memeData = [
      {
        top: "When the clock hits 9:01 AM",
        bottom: "And the professor locks the door from inside",
        caption: "Attendance is gone... 😭 #sadlife #dseu",
        c1: '#ef4444', c2: '#f59e0b'
      },
      {
        top: "Canteen Samosa vs Canteen Juice",
        bottom: "Decisions that determine the rest of my day",
        caption: "Pocket money struggles are real.",
        c1: '#3b82f6', c2: '#10b981'
      },
      {
        top: "The syllabus 1 day before exams",
        bottom: "What I actually studied: Page 1 and the intro",
        caption: "Internal exams are hitting hard.",
        c1: '#8b5cf6', c2: '#ec4899'
      },
      {
        top: "The DSEU Library AC",
        bottom: "The only thing keeping our cool on campus",
        caption: "Best spot in the whole college, change my mind.",
        c1: '#10b981', c2: '#06b6d4'
      },
      {
        top: "Professor asks for assignment today",
        bottom: "Me who thought it was due next month",
        caption: "Wait, there was an assignment?!",
        c1: '#f59e0b', c2: '#ef4444'
      },
      {
        top: "Group projects expectations",
        bottom: "Reality: 1 person coding, 4 people formatting the PPT",
        caption: "Every group project ever.",
        c1: '#8b5cf6', c2: '#06b6d4'
      },
      {
        top: "Placement season reality check",
        bottom: "Ready to work for 2 Samosas and a cup of Chai",
        caption: "Hire me please, I know HTML. 😂",
        c1: '#3b82f6', c2: '#ec4899'
      }
    ];

    const memes = [];
    for (let i = 0; i < memeData.length; i++) {
      const memeInfo = memeData[i];
      const reactionsMap = new Map();
      emojiReactions.forEach(emoji => {
        const reactorCount = Math.floor(Math.random() * 5);
        const reactors = [];
        for (let r = 0; r < reactorCount; r++) {
          reactors.push(getRandomUser().browserToken);
        }
        reactionsMap.set(emoji, reactors);
      });

      const comments = [
        {
          text: "This is too accurate! 😂",
          sender: getRandomUser()._id
        },
        {
          text: "I feel personally attacked by this meme.",
          sender: getRandomUser()._id
        }
      ];

      const meme = await Meme.create({
        imageUrl: getMemeSvgUrl(memeInfo.top, memeInfo.bottom, memeInfo.c1, memeInfo.c2),
        caption: memeInfo.caption,
        sender: getRandomUser()._id,
        campus: 'DSEU',
        reactions: reactionsMap,
        comments: comments,
        createdAt: new Date(Date.now() - i * 7200000)
      });
      memes.push(meme);
    }
    console.log(`Seeded ${memes.length} memes.`);

    // 4. Seed 10 Live Chat Messages
    const chatMessages = [
      "Yo, anyone in the library right now? Is the AC on?",
      "Yeah, it's chill here. Bring a jacket 😂",
      "Anyone got the syllabus for Database Management?",
      "Check the portal, professor uploaded it yesterday.",
      "Canteen is so crowded today, what's going on?",
      "Chai is back on the menu! That's why.",
      "Oh nice, heading there now.",
      "Remember guys, assignment submission is before 4 PM today.",
      "Wait, what assignment? Don't scare me like this.",
      "The one for Computer Networks. RIP if you haven't started."
    ];

    const chatReactions = ['❤️', '😂', '🔥'];
    for (let i = 0; i < chatMessages.length; i++) {
      const reactionsMap = new Map();
      chatReactions.forEach(emoji => {
        if (Math.random() > 0.6) {
          const reactors = [getRandomUser().browserToken];
          reactionsMap.set(emoji, reactors);
        } else {
          reactionsMap.set(emoji, []);
        }
      });

      await LiveChatMessage.create({
        text: chatMessages[i],
        sender: seededUsers[i % seededUsers.length]._id,
        campus: 'DSEU',
        reactions: reactionsMap,
        createdAt: new Date(Date.now() - (10 - i) * 60000) // 1 min intervals
      });
    }
    console.log('Seeded 10 chat messages.');

    // 5. Seed 3 Polls (Admin created)
    // We will assign the first user as the creator of the polls
    const adminUser = seededUsers[0];

    const pollsData = [
      {
        question: "What is the best spot to hang out on campus?",
        options: [
          { text: "College Canteen", votes: seededUsers.slice(1, 4).map(u => u.browserToken) },
          { text: "Library (mainly for AC)", votes: seededUsers.slice(4, 9).map(u => u.browserToken) },
          { text: "Behind the Block B lawn", votes: seededUsers.slice(9, 11).map(u => u.browserToken) },
          { text: "Stairs near the entrance", votes: seededUsers.slice(11, 13).map(u => u.browserToken) }
        ]
      },
      {
        question: "How ready are you for the upcoming end-semester exams?",
        options: [
          { text: "100% prepared, syllabus completed", votes: seededUsers.slice(1, 2).map(u => u.browserToken) },
          { text: "Will pass by studying the night before", votes: seededUsers.slice(2, 8).map(u => u.browserToken) },
          { text: "Only God can save me now", votes: seededUsers.slice(8, 14).map(u => u.browserToken) },
          { text: "Wait, we have exams?", votes: seededUsers.slice(14, 15).map(u => u.browserToken) }
        ]
      },
      {
        question: "Is the biometric attendance rule (75%) working out for you?",
        options: [
          { text: "Yes, keeps me disciplined", votes: seededUsers.slice(1, 3).map(u => u.browserToken) },
          { text: "No, absolute waste of time", votes: seededUsers.slice(3, 11).map(u => u.browserToken) },
          { text: "I have master keys to bypass it", votes: seededUsers.slice(11, 15).map(u => u.browserToken) }
        ]
      }
    ];

    for (const pollInfo of pollsData) {
      await Poll.create({
        question: pollInfo.question,
        options: pollInfo.options,
        sender: adminUser._id,
        campus: 'DSEU',
        isActive: true
      });
    }

    console.log('Seeded 3 polls successfully.');
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
