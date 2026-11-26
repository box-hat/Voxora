using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Voxora.Api.Models;

public static partial class TrackingCode
{
    [GeneratedRegex(@"^VX-\d{8}$")]
    private static partial Regex Format();

    public static string Normalize(string? code) =>
        (code ?? string.Empty).Trim().ToUpperInvariant().Replace(" ", string.Empty);

    public static bool IsValid(string code) => Format().IsMatch(code);

    public static string Generate() =>
        "VX-" + RandomNumberGenerator.GetInt32(10_000_000, 100_000_000);
}
