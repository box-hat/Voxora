
namespace Voxora.Api.Models;

public class Concern
{
    public int Id { get; set; }

    public string TrackingCode { get; set; } = string.Empty;

    public int CategoryId { get; set; }

    public string Subject { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public string? AdminResponse { get; set; }

    public int? AssignedAdminId { get; set; }

    public bool IsAnonymous { get; set; } = true;

    public DateTime SubmittedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
