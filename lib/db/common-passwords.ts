/**
 * Curated common-password blocklist (lowercased). Seeded into `common_passwords`
 * and used by policy's blockCommon check as a fast local complement to HIBP.
 * ponytail: a focused ~180-entry list, not the full SecLists corpus — swap in a
 * larger file at seed time if you need it (see lib/db/seed.ts).
 */
export const COMMON_PASSWORDS: string[] = [
  "123456", "password", "123456789", "12345678", "12345", "1234567", "1234567890",
  "qwerty", "abc123", "111111", "123123", "admin", "letmein", "welcome", "monkey",
  "1234", "000000", "iloveyou", "password1", "qwerty123", "1q2w3e4r", "qwertyuiop",
  "123321", "password123", "dragon", "sunshine", "princess", "football", "baseball",
  "master", "hello", "freedom", "whatever", "qazwsx", "trustno1", "654321", "jordan23",
  "harley", "shadow", "superman", "michael", "ninja", "mustang", "batman", "soccer",
  "starwars", "hunter", "buster", "thomas", "robert", "matthew", "jordan", "daniel",
  "andrew", "joshua", "charlie", "michelle", "jessica", "asshole", "pepper", "ginger",
  "hannah", "maggie", "summer", "ashley", "nicole", "chelsea", "biteme", "matrix",
  "secret", "diamond", "letmein1", "amanda", "cookie", "computer", "internet", "samsung",
  "google", "purple", "orange", "banana", "apple", "cheese", "silver", "gold",
  "flower", "loveme", "iloveu", "test", "test123", "guest", "root", "toor",
  "pass", "passw0rd", "p@ssw0rd", "p@ssword", "passw0rd1", "welcome1", "welcome123",
  "admin123", "administrator", "changeme", "default", "system", "manager", "office",
  "money", "access", "login", "user", "temp", "temp123", "abcd1234", "1qaz2wsx",
  "zaq12wsx", "qwe123", "asdf", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm", "poiuy",
  "lkjhg", "1qazxsw2", "q1w2e3r4", "a1b2c3d4", "1a2b3c4d", "abcabc", "aaaaaa", "bbbbbb",
  "121212", "112233", "123abc", "555555", "666666", "777777", "888888", "999999",
  "101010", "womanizer", "iloveyou1", "princess1", "rockyou", "michael1", "jennifer",
  "hello123", "loveyou", "football1", "baseball1", "starwars1", "superman1", "batman1",
  "trustno1!", "monkey123", "dragon123", "master123", "shadow123", "ranger", "harley123",
  "summer2024", "summer2024!", "winter2024", "spring2024", "autumn2024", "january",
  "february", "december", "qwerty1", "qwerty12", "asdfg", "zxcvb", "159753", "753951",
  "147258369", "abcdef", "abcdefg", "letmein123", "sunshine1", "iloveyou123", "password12",
];
