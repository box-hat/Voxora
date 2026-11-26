using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Data;
using Voxora.Api.Models;

namespace Voxora.Api.Auth;

/// <summary>
/// Command-line admin management, run instead of the web server:
///
///   dotnet Voxora.Api.dll create-admin --username Adachi [--full-name "..."] [--email ...]
///
/// Prompts for the password (not echoed). --password works too, but leaves
/// the password in shell history. If the username exists, its password is
/// reset and the account re-activated.
/// Docker: docker compose exec app dotnet Voxora.Api.dll create-admin --username NAME
/// </summary>
public static class AdminCli
{
    public static bool IsCommand(string[] args) =>
        args.Length > 0 && args[0] == "create-admin";

    public static async Task<int> RunAsync(WebApplication app, string[] args)
    {
        var options = ParseOptions(args.Skip(1).ToArray());
        var username = options.GetValueOrDefault("username")?.Trim();

        if (string.IsNullOrEmpty(username))
        {
            Console.Error.WriteLine("Usage: create-admin --username NAME [--full-name NAME] [--email EMAIL] [--password PASSWORD]");
            return 2;
        }

        var minLength = app.Environment.IsDevelopment() ? 8 : 12;
        var password = options.GetValueOrDefault("password") ?? PromptPassword(minLength);

        if (password is null)
            return 1;

        if (password.Length < minLength)
        {
            Console.Error.WriteLine($"Password must be at least {minLength} characters.");
            return 1;
        }

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VoxoraDbContext>();
        var hasher = new PasswordHasher<Admin>();

        var admin = await db.Admins.FirstOrDefaultAsync(a => a.Username == username);
        var created = admin is null;

        if (admin is null)
        {
            admin = new Admin { Username = username, CreatedAt = DateTime.UtcNow };
            db.Admins.Add(admin);
        }
        else
        {
            admin.UpdatedAt = DateTime.UtcNow;
        }

        admin.FullName = options.GetValueOrDefault("full-name")?.Trim() is { Length: > 0 } fullName
            ? fullName
            : (created ? username : admin.FullName);
        admin.Email = options.GetValueOrDefault("email")?.Trim() ?? admin.Email;
        admin.IsActive = true;
        admin.PasswordHash = hasher.HashPassword(admin, password);

        await db.SaveChangesAsync();

        Console.WriteLine(created
            ? $"Created admin account '{admin.Username}'."
            : $"Updated admin account '{admin.Username}' (password reset, account active).");
        return 0;
    }

    private static Dictionary<string, string> ParseOptions(string[] args)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i].StartsWith("--"))
            {
                result[args[i][2..]] = args[i + 1];
                i++;
            }
        }
        return result;
    }

    private static string? PromptPassword(int minLength)
    {
        if (Console.IsInputRedirected)
        {
            // Allows: echo "password" | dotnet Voxora.Api.dll create-admin --username NAME
            return Console.ReadLine();
        }

        var first = ReadHidden($"Password (min {minLength} characters): ");
        var second = ReadHidden("Repeat password: ");

        if (first != second)
        {
            Console.Error.WriteLine("Passwords do not match.");
            return null;
        }
        return first;
    }

    private static string ReadHidden(string prompt)
    {
        Console.Write(prompt);
        var sb = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace)
            {
                if (sb.Length > 0) sb.Length--;
                continue;
            }
            if (!char.IsControl(key.KeyChar)) sb.Append(key.KeyChar);
        }
        Console.WriteLine();
        return sb.ToString();
    }
}
