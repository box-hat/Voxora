namespace Voxora.Api.Models;

public static class ConcernStatus
{
    public const string Pending = "Pending";
    public const string UnderReview = "Under Review";
    public const string Resolved = "Resolved";
    public const string Rejected = "Rejected";

    public static readonly IReadOnlyList<string> All =
        [Pending, UnderReview, Resolved, Rejected];
}
