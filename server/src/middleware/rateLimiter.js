import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

// Tight rate limiter for posting confessions and memes
export const postingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 posts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'POSTING_RATE_LIMIT',
    message: 'Slow down! You can only post up to 5 times per minute.'
  }
});

// Tight rate limiter for emoji reactions and poll voting
export const interactionLimiter = rateLimit({
  windowMs: 30 * 1000, // 30 seconds
  max: 15, // Limit each IP to 15 interactions per 30 seconds
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'INTERACTION_RATE_LIMIT',
    message: 'You are interacting too fast! Take a breather.'
  }
});
