-- Voxora database schema (MySQL 8 / MariaDB 10.6+).
-- Safe to run on an empty database; tables that already exist are skipped.
--
--   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS voxora_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--   mysql -u root -p voxora_db < database/schema.sql
--
-- Keep in sync with Voxora.Api/Data/VoxoraDbContext.cs.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `admins` (
    `id`            int          NOT NULL AUTO_INCREMENT,
    `full_name`     varchar(150) NOT NULL,
    `username`      varchar(100) NOT NULL,
    `email`         varchar(254) NOT NULL,
    `password_hash` varchar(255) NOT NULL,
    `is_active`     tinyint(1)   NOT NULL DEFAULT 1,
    `created_at`    datetime(6)  NOT NULL,
    `updated_at`    datetime(6)  NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `IX_admins_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
    `id`          int          NOT NULL AUTO_INCREMENT,
    `name`        varchar(100) NOT NULL,
    `description` text         NULL,
    `is_active`   tinyint(1)   NOT NULL DEFAULT 1,
    `created_at`  datetime(6)  NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `IX_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `concerns` (
    `id`                int          NOT NULL AUTO_INCREMENT,
    `tracking_code`     varchar(20)  NOT NULL,
    `category_id`       int          NOT NULL,
    `subject`           varchar(100) NOT NULL,
    `description`       text         NOT NULL,
    `status`            varchar(30)  NOT NULL,
    `admin_response`    text         NULL,
    `assigned_admin_id` int          NULL,
    `is_anonymous`      tinyint(1)   NOT NULL DEFAULT 1,
    `submitted_at`      datetime(6)  NOT NULL,
    `updated_at`        datetime(6)  NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `IX_concerns_tracking_code` (`tracking_code`),
    KEY `IX_concerns_category_id` (`category_id`),
    KEY `IX_concerns_assigned_admin_id` (`assigned_admin_id`),
    KEY `IX_concerns_submitted_at` (`submitted_at`),
    -- Categories are soft-deleted; never cascade-delete concerns.
    CONSTRAINT `FK_concerns_categories_category_id`
        FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_concerns_admins_assigned_admin_id`
        FOREIGN KEY (`assigned_admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `concern_status_history` (
    `id`                  int         NOT NULL AUTO_INCREMENT,
    `concern_id`          int         NOT NULL,
    `status`              varchar(30) NOT NULL,
    `note`                text        NULL,
    `changed_by_admin_id` int         NULL,
    `changed_at`          datetime(6) NOT NULL,
    PRIMARY KEY (`id`),
    KEY `IX_concern_status_history_concern_id` (`concern_id`),
    KEY `IX_concern_status_history_changed_by_admin_id` (`changed_by_admin_id`),
    CONSTRAINT `FK_concern_status_history_concerns_concern_id`
        FOREIGN KEY (`concern_id`) REFERENCES `concerns` (`id`) ON DELETE CASCADE,
    CONSTRAINT `FK_concern_status_history_admins_changed_by_admin_id`
        FOREIGN KEY (`changed_by_admin_id`) REFERENCES `admins` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Starter categories (edit or remove as needed; skipped if they exist).
INSERT IGNORE INTO `categories` (`name`, `description`, `is_active`, `created_at`) VALUES
    ('Academic',       'Classes, grading, instructors and curriculum.',        1, UTC_TIMESTAMP(6)),
    ('Facilities',     'Classrooms, restrooms, equipment and campus grounds.', 1, UTC_TIMESTAMP(6)),
    ('Student Services','Registrar, library, clinic, guidance and canteen.',   1, UTC_TIMESTAMP(6)),
    ('Safety & Security','Bullying, harassment, safety hazards.',              1, UTC_TIMESTAMP(6)),
    ('Other',          'Anything that does not fit the categories above.',     1, UTC_TIMESTAMP(6));
