using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Data;
using Voxora.Api.Models;

namespace Voxora.Api.Auth;

/// <summary>
/// Creates the first administrator account from configuration if it does not
/// exist yet. Configure with environment variables, for example:
///   AdminBootstrap__Username=admin
///   AdminBootstrap__Password=a-long-random-password
/// Existing accounts are never modified. Remove the password from the
/// environment once the account exists.
/// </summary>
public static class AdminBootstrapper
{
    private const int MinPasswordLength = 12;

    public static async Task EnsureBootstrapAdminAsync(this WebApplication app)
    {
        var config = app.Configuration.GetSection("AdminBootstrap");
        var username = config["Username"]?.Trim();
        var password = config["Password"];

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            return;

        var logger = app.Services.GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(AdminBootstrapper));

        if (!app.Environment.IsDevelopment() && password.Length < MinPasswordLength)
        {
            throw new InvalidOperationException(
                $"AdminBootstrap:Password must be at least {MinPasswordLength} characters.");
        }

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VoxoraDbContext>();

        try
        {
            if (await db.Admins.AnyAsync(a => a.Username == username))
                return;

            var admin = new Admin
            {
                Username = username,
                FullName = config["FullName"]?.Trim() is { Length: > 0 } name ? name : username,
                Email = config["Email"]?.Trim() ?? string.Empty,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            admin.PasswordHash = new PasswordHasher<Admin>().HashPassword(admin, password);

            db.Admins.Add(admin);
            await db.SaveChangesAsync();

            logger.LogInformation("Created administrator account '{Username}'.", username);
        }
        catch (Exception ex)
        {
            // Do not stop the app (the database may be temporarily down);
            // the account is created on the next start.
            logger.LogError(ex, "Could not create the bootstrap administrator account.");
        }
    }
}
