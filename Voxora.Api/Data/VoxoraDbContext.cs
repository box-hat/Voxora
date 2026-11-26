
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Models;

namespace Voxora.Api.Data;

public class VoxoraDbContext : DbContext
{
    public VoxoraDbContext(DbContextOptions<VoxoraDbContext> options)
        : base(options)
    {
    }

    public DbSet<Admin> Admins => Set<Admin>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Concern> Concerns => Set<Concern>();
    public DbSet<ConcernStatusHistory> ConcernStatusHistories
        => Set<ConcernStatusHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ADMINS TABLE
        modelBuilder.Entity<Admin>(entity =>
        {
            entity.ToTable("admins");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.FullName).HasColumnName("full_name").HasMaxLength(150);
            entity.Property(e => e.Username).HasColumnName("username").HasMaxLength(100);
            entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(254);
            entity.Property(e => e.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.Username).IsUnique();
        });

        // CATEGORIES TABLE
        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("categories");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100);
            entity.Property(e => e.Description).HasColumnName("description").HasColumnType("text");
            entity.Property(e => e.IsActive).HasColumnName("is_active");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.Name).IsUnique();
        });

        // CONCERNS TABLE
        modelBuilder.Entity<Concern>(entity =>
        {
            entity.ToTable("concerns");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TrackingCode).HasColumnName("tracking_code").HasMaxLength(20);
            entity.Property(e => e.CategoryId).HasColumnName("category_id");
            entity.Property(e => e.Subject).HasColumnName("subject").HasMaxLength(100);
            entity.Property(e => e.Description).HasColumnName("description").HasColumnType("text");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30);
            entity.Property(e => e.AdminResponse).HasColumnName("admin_response").HasColumnType("text");
            entity.Property(e => e.AssignedAdminId).HasColumnName("assigned_admin_id");
            entity.Property(e => e.IsAnonymous).HasColumnName("is_anonymous");
            entity.Property(e => e.SubmittedAt).HasColumnName("submitted_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            entity.HasIndex(e => e.TrackingCode).IsUnique();
            entity.HasIndex(e => e.SubmittedAt);

            entity.HasOne<Category>()
                .WithMany()
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<Admin>()
                .WithMany()
                .HasForeignKey(e => e.AssignedAdminId)
                .IsRequired(false);
        });

        // CONCERN STATUS HISTORY TABLE
        modelBuilder.Entity<ConcernStatusHistory>(entity =>
        {
            entity.ToTable("concern_status_history");
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ConcernId).HasColumnName("concern_id");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(30);
            entity.Property(e => e.Note).HasColumnName("note").HasColumnType("text");
            entity.Property(e => e.ChangedByAdminId).HasColumnName("changed_by_admin_id");
            entity.Property(e => e.ChangedAt).HasColumnName("changed_at");

            entity.HasOne<Concern>()
                .WithMany()
                .HasForeignKey(e => e.ConcernId);

            entity.HasOne<Admin>()
                .WithMany()
                .HasForeignKey(e => e.ChangedByAdminId)
                .IsRequired(false);
        });
    }
}
