-- Drop unused Session model (auth uses RefreshToken only)
DROP TABLE IF EXISTS "sessions";
