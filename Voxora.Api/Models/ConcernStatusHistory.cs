
namespace Voxora.Api.Models;

public class ConcernStatusHistory
{
    public int Id { get; set; }

    public int ConcernId { get; set; }

    public string Status { get; set; } = "Pending";

    public string? Note { get; set; }

    public int? ChangedByAdminId { get; set; }

    public DateTime ChangedAt { get; set; }
}
