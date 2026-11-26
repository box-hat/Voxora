using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Voxora.Api.Infrastructure;

/// <summary>Per-IP request limits for the public and login endpoints.</summary>
public static class RateLimits
{
    public const string Login = "login";
    public const string SubmitConcern = "submit-concern";
    public const string TrackConcern = "track-concern";

    public static IServiceCollection AddVoxoraRateLimits(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.OnRejected = async (context, token) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                }

                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { message = "Too many requests. Please wait a moment and try again." },
                    token);
            };

            // Brute-force protection for admin passwords.
            options.AddPolicy(Login, context => PerIp(context, permitLimit: 5, TimeSpan.FromMinutes(1)));

            // Spam protection for anonymous submissions. Generous because a
            // whole school network often shares one public IP address.
            options.AddPolicy(SubmitConcern, context => PerIp(context, permitLimit: 20, TimeSpan.FromMinutes(10)));

            // Makes guessing tracking codes impractical (90 million possible
            // codes at 60 guesses/minute is years of guessing).
            options.AddPolicy(TrackConcern, context => PerIp(context, permitLimit: 60, TimeSpan.FromMinutes(1)));
        });

        return services;
    }

    private static RateLimitPartition<string> PerIp(HttpContext context, int permitLimit, TimeSpan window) =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = window,
                QueueLimit = 0
            });
}
