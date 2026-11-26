using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Data;

namespace Voxora.Api.Auth;

public static class AdminAuth
{
    public const string CookieName = "voxora.auth";

    public static IServiceCollection AddAdminAuthentication(this IServiceCollection services)
    {
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                // Strict: the cookie is never sent on cross-site requests (CSRF protection).
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.SlidingExpiration = true;

                // This is an API: answer 401/403 instead of redirecting to a login page.
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return Task.CompletedTask;
                };

                // Sign out admins that were deactivated or deleted after logging in.
                options.Events.OnValidatePrincipal = ValidateAdminStillActive;
            });

        services.AddAuthorization();

        return services;
    }

    public static int? GetAdminId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private static async Task ValidateAdminStillActive(CookieValidatePrincipalContext context)
    {
        var adminId = context.Principal?.GetAdminId();

        var db = context.HttpContext.RequestServices.GetRequiredService<VoxoraDbContext>();

        var active = adminId is not null && await db.Admins
            .AsNoTracking()
            .AnyAsync(a => a.Id == adminId && a.IsActive);

        if (!active)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }
    }
}
