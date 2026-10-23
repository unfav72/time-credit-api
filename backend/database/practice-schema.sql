-- ============================================================================
-- TIMECREDIT LIVE: CONTROLLED SQL PRACTICE DATABASE SCHEMA
-- Purpose: Isolated educational database environment for students and evaluators
--          Allows practicing SELECT, JOIN, GROUP BY, subqueries, DDL & DML safely.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `timecredit_practice`
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `timecredit_practice`;

DROP TABLE IF EXISTS `practice_credit_logs`;
DROP TABLE IF EXISTS `assignments`;
DROP TABLE IF EXISTS `study_groups`;
DROP TABLE IF EXISTS `enrollments`;
DROP TABLE IF EXISTS `courses`;
DROP TABLE IF EXISTS `instructors`;
DROP TABLE IF EXISTS `students`;

-- 1. Students Table
CREATE TABLE `students` (
    `student_id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `major` VARCHAR(60) NOT NULL,
    `gpa` DECIMAL(3, 2) DEFAULT 3.00,
    `time_credits_balance` DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
    `enrollment_year` INT NOT NULL DEFAULT 2024
);

-- 2. Instructors Table
CREATE TABLE `instructors` (
    `instructor_id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(100) NOT NULL,
    `department` VARCHAR(80) NOT NULL,
    `rating` DECIMAL(3, 2) DEFAULT 4.50,
    `hourly_credit_rate` DECIMAL(4, 2) NOT NULL DEFAULT 1.00
);

-- 3. Courses Table
CREATE TABLE `courses` (
    `course_id` INT AUTO_INCREMENT PRIMARY KEY,
    `course_code` VARCHAR(10) NOT NULL UNIQUE,
    `title` VARCHAR(150) NOT NULL,
    `department` VARCHAR(80) NOT NULL,
    `credits` INT NOT NULL DEFAULT 3,
    `instructor_id` INT,
    CONSTRAINT `fk_course_instructor` FOREIGN KEY (`instructor_id`) 
        REFERENCES `instructors` (`instructor_id`) ON DELETE SET NULL
);

-- 4. Enrollments Table (Many-to-Many Bridge)
CREATE TABLE `enrollments` (
    `enrollment_id` INT AUTO_INCREMENT PRIMARY KEY,
    `student_id` INT NOT NULL,
    `course_id` INT NOT NULL,
    `grade` VARCHAR(3) DEFAULT 'A',
    `attendance_pct` DECIMAL(5, 2) DEFAULT 95.00,
    `enrolled_at` DATE NOT NULL,
    CONSTRAINT `fk_enr_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_enr_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE
);

-- 5. Study Groups Table
CREATE TABLE `study_groups` (
    `group_id` INT AUTO_INCREMENT PRIMARY KEY,
    `course_id` INT NOT NULL,
    `group_name` VARCHAR(100) NOT NULL,
    `max_members` INT NOT NULL DEFAULT 6,
    `meeting_day` VARCHAR(20) NOT NULL DEFAULT 'Wednesday',
    CONSTRAINT `fk_group_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE
);

-- 6. Assignments Table
CREATE TABLE `assignments` (
    `assignment_id` INT AUTO_INCREMENT PRIMARY KEY,
    `course_id` INT NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `max_score` INT NOT NULL DEFAULT 100,
    `due_date` DATE NOT NULL,
    CONSTRAINT `fk_assign_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`) ON DELETE CASCADE
);

-- 7. Practice Credit Logs (Ledger practice)
CREATE TABLE `practice_credit_logs` (
    `log_id` INT AUTO_INCREMENT PRIMARY KEY,
    `student_id` INT NOT NULL,
    `amount` DECIMAL(6, 2) NOT NULL,
    `action` ENUM('EARNED', 'SPENT') NOT NULL,
    `note` VARCHAR(200) NOT NULL,
    `logged_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_log_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`student_id`) ON DELETE CASCADE
);

-- ============================================================================
-- SEED DATA FOR PRACTICE ENVIRONMENT
-- ============================================================================

INSERT INTO `students` (`student_id`, `full_name`, `email`, `major`, `gpa`, `time_credits_balance`, `enrollment_year`) VALUES
(1, 'Aarav Patel', 'aarav.patel@college.edu', 'Computer Science', 3.85, 12.50, 2023),
(2, 'Diya Sharma', 'diya.sharma@college.edu', 'Information Technology', 3.92, 8.00, 2023),
(3, 'Rohan Verma', 'rohan.verma@college.edu', 'Data Science', 3.40, 4.50, 2024),
(4, 'Ananya Iyer', 'ananya.iyer@college.edu', 'Software Engineering', 3.78, 15.00, 2023),
(5, 'Kabir Mehta', 'kabir.mehta@college.edu', 'Cybersecurity', 3.15, 2.00, 2024),
(6, 'Pooja Reddy', 'pooja.reddy@college.edu', 'Artificial Intelligence', 3.95, 18.50, 2022),
(7, 'Siddharth Rao', 'sid.rao@college.edu', 'Computer Science', 2.90, 6.00, 2024),
(8, 'Meera Nair', 'meera.nair@college.edu', 'Information Technology', 3.65, 9.50, 2023);

INSERT INTO `instructors` (`instructor_id`, `full_name`, `department`, `rating`, `hourly_credit_rate`) VALUES
(1, 'Dr. Ramesh Sundaram', 'Computer Science', 4.90, 1.50),
(2, 'Prof. Priya Kulkarni', 'Information Technology', 4.75, 1.00),
(3, 'Dr. Vikram Malhotra', 'Data Science', 4.85, 1.50),
(4, 'Prof. Shalini Gupta', 'Mathematics', 4.60, 1.00);

INSERT INTO `courses` (`course_id`, `course_code`, `title`, `department`, `credits`, `instructor_id`) VALUES
(1, 'CS301', 'Database Management Systems', 'Computer Science', 4, 1),
(2, 'CS302', 'Data Structures & Algorithms', 'Computer Science', 4, 1),
(3, 'IT205', 'Web Full-Stack Engineering', 'Information Technology', 3, 2),
(4, 'DS401', 'Machine Learning & Big Data', 'Data Science', 4, 3),
(5, 'MA102', 'Discrete Mathematics', 'Mathematics', 3, 4);

INSERT INTO `enrollments` (`student_id`, `course_id`, `grade`, `attendance_pct`, `enrolled_at`) VALUES
(1, 1, 'A', 98.0, '2024-01-15'),
(1, 2, 'A-', 92.5, '2024-01-15'),
(2, 1, 'A+', 100.0, '2024-01-15'),
(2, 3, 'A', 96.0, '2024-01-15'),
(3, 1, 'B+', 85.0, '2024-01-15'),
(3, 4, 'B', 88.0, '2024-01-15'),
(4, 2, 'A', 97.0, '2024-01-15'),
(4, 3, 'A+', 99.0, '2024-01-15'),
(5, 1, 'C+', 76.0, '2024-01-15'),
(6, 1, 'A+', 99.5, '2024-01-15'),
(6, 4, 'A', 95.0, '2024-01-15'),
(7, 2, 'B-', 80.0, '2024-01-15'),
(8, 3, 'A-', 91.0, '2024-01-15');

INSERT INTO `study_groups` (`group_id`, `course_id`, `group_name`, `max_members`, `meeting_day`) VALUES
(1, 1, 'SQL Masters Peer Group', 6, 'Tuesday'),
(2, 1, 'DBMS Query Optimization Circle', 5, 'Thursday'),
(3, 3, 'React & Vite Builders Club', 8, 'Friday'),
(4, 4, 'Deep Learning Lab Cohort', 4, 'Saturday');

INSERT INTO `assignments` (`assignment_id`, `course_id`, `title`, `max_score`, `due_date`) VALUES
(1, 1, 'Lab 1: SQL Joins and Aggregations', 100, '2024-02-10'),
(2, 1, 'Lab 2: Normalization and 3NF Proof', 100, '2024-02-25'),
(3, 1, 'Project: Relational Schema Design', 150, '2024-03-20'),
(4, 3, 'Full-Stack PWA Prototype', 100, '2024-03-05');

INSERT INTO `practice_credit_logs` (`student_id`, `amount`, `action`, `note`) VALUES
(1, 2.0, 'EARNED', 'Tutored CS301 SQL Indexing Session (2 hours)'),
(1, 1.0, 'SPENT', 'Attended DS401 Python Intro Workshop (1 hour)'),
(2, 3.0, 'EARNED', 'Led Web Architecture Live Lab (3 hours)'),
(4, 2.5, 'EARNED', 'Explained Binary Search Trees (2.5 hours)'),
(5, 1.0, 'SPENT', 'Attended SQL Basics Coaching (1 hour)');
