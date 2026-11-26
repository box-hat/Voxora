using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Voxora.Api.Auth;
using Voxora.Api.Data;
using Voxora.Api.Hubs;
using Voxora.Api.Infrastructure;

// `dotnet Voxora.Api.dll --healthcheck`: used by the Docker HEALTHCHECK
// (the runtime image has no curl). Checks the running instance and exits.
if (args.Contains("--healthcheck"))
{
    var port = Environment.GetEnvironmentVariable("ASPNETCORE_HTTP_PORTS")?.Split(';')[0] ?? "8080";
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
    try
    {
        var response = await http.GetAsync($"http://localhost:{port}/health");
        return response.IsSuccessStatusCode ? 0 : 1;
    }
    catch
    {
        return 1;
    }
}

var builder = WebApplication.CreateBuilder(args);

// ---- Services -----------------------------------------------------------

builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddProblemDetails();

// MySQL. Production: set ConnectionStrings__DefaultConnection as an
// environment variable (never commit real credentials).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'DefaultConnection' is missing. " +
        "Set the ConnectionStrings__DefaultConnection environment variable.");
}

builder.Services.AddDbContext<VoxoraDbContext>(options =>
    options.UseMySQL(connectionString));

// Keys that encrypt the login cookie. Must survive restarts/redeploys, or
// every admin is signed out. In containers point this at a mounted volume.
var keysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(keysPath))
{
    builder.Services.AddDataProtection()
        .SetApplicationName("Voxora")
        .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
}

builder.Services.AddAdminAuthentication();
builder.Services.AddVoxoraRateLimits();

builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

// Optional CORS, only needed if the frontend is hosted on another origin.
// The default setup serves the frontend from this app (same origin).
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (corsOrigins.Length > 0)
{
    builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
        .WithOrigins(corsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));
}

// Behind a reverse proxy (nginx, Caddy, a load balancer) that terminates
// HTTPS: set ReverseProxy__Enabled=true so client IPs (used for rate limits)
// and the HTTPS scheme are read from X-Forwarded-* headers. Only enable this
// when the app is NOT reachable directly, or clients could spoof their IP.
var behindProxy = builder.Configuration.GetValue<bool>("ReverseProxy:Enabled");
if (behindProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

var app = builder.Build();

// ---- Pipeline -------------------------------------------------------------

if (behindProxy)
{
    app.UseForwardedHeaders();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    // Generic error responses (no stack traces) and HSTS in production.
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseStatusCodePages();
// Health probes come from inside the host/container over plain HTTP.
app.UseWhen(
    context => !context.Request.Path.StartsWithSegments("/health"),
    branch => branch.UseHttpsRedirection());
app.UseSecurityHeaders();

// Built Angular app (copied into wwwroot by the Dockerfile / publish step).
// In development the Angular dev server serves it instead.
var hasFrontend = Directory.Exists(app.Environment.WebRootPath);
if (hasFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

if (corsOrigins.Length > 0)
{
    app.UseCors();
}

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ConcernsHub>(ConcernsHub.Path);

// Liveness: the process is up. Readiness: the database is reachable too.
app.MapHealthChecks("/health", new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = check => check.Tags.Contains("ready") });

// Unknown API routes are 404s, everything else is an Angular route.
app.Map("/api/{**path}", () => Results.NotFound());
if (hasFrontend)
{
    app.MapFallbackToFile("index.html");
}

// `create-admin`: manage admin accounts from the command line, then exit.
if (AdminCli.IsCommand(args))
{
    return await AdminCli.RunAsync(app, args);
}

await app.EnsureBootstrapAdminAsync();

app.Run();
return 0;
