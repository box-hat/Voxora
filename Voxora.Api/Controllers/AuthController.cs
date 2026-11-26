using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Auth;
using Voxora.Api.Data;
using Voxora.Api.Infrastructure;
using Voxora.Api.Models;

namespace Voxora.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string InvalidCredentials = "Invalid username or password.";

    // Verified against when the username does not exist, so a failed login
    // takes the same time whether or not the account exists.
    private static readonly string DummyHash =
        new PasswordHasher<Admin>().HashPassword(new Admin(), Guid.NewGuid().ToString());

    private readonly VoxoraDbContext _context;
    private readonly ILogger<AuthController> _logger;
    private readonly PasswordHasher<Admin> _hasher = new();

    public AuthController(VoxoraDbContext context, ILogger<AuthController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // POST: api/auth/login
    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var username = request.Username.Trim();

        var admin = await _context.Admins
            .FirstOrDefaultAsync(a => a.Username == username && a.IsActive);

        var result = Verify(admin ?? new Admin(), admin?.PasswordHash ?? DummyHash, request.Password);

        if (admin is null || result == PasswordVerificationResult.Failed)
        {
            _logger.LogWarning("Failed admin login for '{Username}' from {Ip}.",
                username, HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new { message = InvalidCredentials });
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            admin.PasswordHash = _hasher.HashPassword(admin, request.Password);
            admin.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
                new Claim(ClaimTypes.Name, admin.Username),
                new Claim("full_name", admin.FullName)
            ],
            CookieAuthenticationDefaults.AuthenticationScheme);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = request.RememberMe });

        _logger.LogInformation("Admin '{Username}' signed in.", admin.Username);

        return Ok(ToDto(admin.Id, admin.Username, admin.FullName));
    }

    // POST: api/auth/logout
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    // GET: api/auth/me
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me() => Ok(ToDto(
        User.GetAdminId() ?? 0,
        User.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
        User.FindFirstValue("full_name") ?? string.Empty));

    private PasswordVerificationResult Verify(Admin admin, string hash, string password)
    {
        try
        {
            return _hasher.VerifyHashedPassword(admin, hash, password);
        }
        catch (FormatException)
        {
            // Stored value is not a hash this app created (e.g. legacy data).
            _logger.LogWarning("Admin '{Username}' has an unsupported password hash format.", admin.Username);
            return PasswordVerificationResult.Failed;
        }
    }

    private static object ToDto(int id, string username, string fullName) =>
        new { id, username, fullName };
}

public class LoginRequest
{
    [Required, StringLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string Password { get; set; } = string.Empty;

    public bool RememberMe { get; set; }
}
