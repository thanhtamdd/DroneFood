IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'DroneFoodDB')
BEGIN
    CREATE DATABASE DroneFoodDB;
END
GO
