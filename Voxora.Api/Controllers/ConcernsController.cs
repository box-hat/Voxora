using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Voxora.Api.Auth;
using Voxora.Api.Data;
using Voxora.Api.Hubs;
using Voxora.Api.Infrastructure;
using Voxora.Api.Models;

namespace Voxora.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConcernsController : ControllerBase
{
    private const int SubjectMin = 5, SubjectMax = 100;
    private const int DescriptionMin = 10, DescriptionMax = 2000;
    private const int AdminResponseMax = 2000;

    private readonly VoxoraDbContext _context;
    private readonly IHubContext<ConcernsHub> _hub;
    private readonly ILogger<ConcernsController> _logger;

    public ConcernsController(
        VoxoraDbContext context,
        IHubContext<ConcernsHub> hub,
        ILogger<ConcernsController> logger)
    {
        _context = context;
        _hub = hub;
        _logger = logger;
    }

    // ---- Public (anonymous students) ----------------------------------------

    // POST: api/concerns
    [HttpPost]
    [EnableRateLimiting(RateLimits.SubmitConcern)]
    public async Task<IActionResult> SubmitConcern([FromBody] SubmitConcernRequest request)
    {
        var categoryName = request.Category?.Trim() ?? string.Empty;
        var subject = request.Subject?.Trim() ?? string.Empty;
        var description = request.Description?.Trim() ?? string.Empty;

        if (categoryName.Length == 0)
            return Error("Please select a concern category.");

        if (subject.Length is < SubjectMin or > SubjectMax)
            return Error($"Subject must be {SubjectMin} to {SubjectMax} characters.");

        if (description.Length is < DescriptionMin or > DescriptionMax)
            return Error($"Description must be {DescriptionMin} to {DescriptionMax} characters.");

        var category = await _context.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Name == categoryName && c.IsActive);

        if (category is null)
            return Error("Selected category was not found.");

        string trackingCode;
        do
        {
            trackingCode = TrackingCode.Generate();
        }
        while (await _context.Concerns.AnyAsync(c => c.TrackingCode == trackingCode));

        var now = DateTime.UtcNow;

        var concern = new Concern
        {
            TrackingCode = trackingCode,
            CategoryId = category.Id,
            Subject = subject,
            Description = description,
            Status = ConcernStatus.Pending,
            IsAnonymous = true,
            SubmittedAt = now
        };

        // Disposing the transaction without committing rolls it back.
        await using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            _context.Concerns.Add(concern);
            await _context.SaveChangesAsync();

            _context.ConcernStatusHistories.Add(new ConcernStatusHistory
            {
                ConcernId = concern.Id,
                Status = ConcernStatus.Pending,
                Note = "Your concern has been successfully submitted.",
                ChangedAt = now
            });
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();
        }

        // Never log subject/description: concerns are anonymous and may be sensitive.
        _logger.LogInformation("Concern {TrackingCode} submitted.", concern.TrackingCode);

        await NotifyAsync(concern.TrackingCode, concern.Status);

        return Ok(new
        {
            message = "Concern submitted successfully.",
            trackingCode = concern.TrackingCode,
            status = concern.Status,
            submittedAt = concern.SubmittedAt
        });
    }

    // GET: api/concerns/{trackingCode}
    [HttpGet("{trackingCode}")]
    [EnableRateLimiting(RateLimits.TrackConcern)]
    public async Task<IActionResult> GetConcernByTrackingCode(string trackingCode)
    {
        var code = TrackingCode.Normalize(trackingCode);

        if (!TrackingCode.IsValid(code))
            return Error("Tracking codes look like VX-12345678.");

        var concern = await (
            from c in _context.Concerns.AsNoTracking()
            join category in _context.Categories.AsNoTracking()
                on c.CategoryId equals category.Id into categories
            from category in categories.DefaultIfEmpty()
            where c.TrackingCode == code
            select new
            {
                c.Id,
                c.TrackingCode,
                Category = category != null ? category.Name : "Unknown",
                c.Subject,
                c.Description,
                c.SubmittedAt,
                c.Status,
                c.AdminResponse
            }
        ).FirstOrDefaultAsync();

        if (concern is null)
            return NotFound(new { message = "Concern not found." });

        var history = await _context.ConcernStatusHistories
            .AsNoTracking()
            .Where(h => h.ConcernId == concern.Id)
            .OrderBy(h => h.ChangedAt)
            .Select(h => new { status = h.Status, date = h.ChangedAt, note = h.Note })
            .ToListAsync();

        return Ok(new
        {
            trackingCode = concern.TrackingCode,
            category = concern.Category,
            subject = concern.Subject,
            description = concern.Description,
            submittedAt = concern.SubmittedAt,
            status = concern.Status,
            adminResponse = concern.AdminResponse ?? string.Empty,
            statusHistory = history
        });
    }

    // ---- Admin only -----------------------------------------------------------

    // GET: api/concerns
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAllConcerns()
    {
        var concerns = await (
            from concern in _context.Concerns.AsNoTracking()
            join category in _context.Categories.AsNoTracking()
                on concern.CategoryId equals category.Id
            orderby concern.SubmittedAt descending
            select new
            {
                trackingCode = concern.TrackingCode,
                category = category.Name,
                subject = concern.Subject,
                description = concern.Description,
                submittedAt = concern.SubmittedAt,
                status = concern.Status,
                adminResponse = concern.AdminResponse ?? string.Empty
            }
        ).ToListAsync();

        return Ok(concerns);
    }

    // GET: api/concerns/report-summary
    [HttpGet("report-summary")]
    [Authorize]
    public async Task<IActionResult> GetReportSummary()
    {
        var statusCounts = await _context.Concerns
            .AsNoTracking()
            .GroupBy(c => c.Status)
            .Select(group => new { status = group.Key, count = group.Count() })
            .ToListAsync();

        var categoryCounts = await (
            from concern in _context.Concerns.AsNoTracking()
            join category in _context.Categories.AsNoTracking()
                on concern.CategoryId equals category.Id
            group concern by category.Name into categoryGroup
            orderby categoryGroup.Count() descending
            select new { name = categoryGroup.Key, count = categoryGroup.Count() }
        ).ToListAsync();

        var recentConcerns = await (
            from concern in _context.Concerns.AsNoTracking()
            join category in _context.Categories.AsNoTracking()
                on concern.CategoryId equals category.Id
            orderby concern.SubmittedAt descending
            select new
            {
                trackingCode = concern.TrackingCode,
                category = category.Name,
                subject = concern.Subject,
                submittedAt = concern.SubmittedAt,
                status = concern.Status
            }
        ).Take(10).ToListAsync();

        return Ok(new { statusCounts, categoryCounts, recentConcerns });
    }

    // GET: api/concerns/dashboard-summary
    [HttpGet("dashboard-summary")]
    [Authorize]
    public async Task<IActionResult> GetDashboardSummary()
    {
        var counts = await _context.Concerns
            .AsNoTracking()
            .GroupBy(c => c.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count);

        int CountOf(string status) => counts.GetValueOrDefault(status);

        var recentSubmissions = await (
            from concern in _context.Concerns.AsNoTracking()
            join category in _context.Categories.AsNoTracking()
                on concern.CategoryId equals category.Id
            orderby concern.SubmittedAt descending
            select new
            {
                trackingCode = concern.TrackingCode,
                subject = concern.Subject,
                category = category.Name,
                status = concern.Status,
                submittedAt = concern.SubmittedAt
            }
        ).Take(5).ToListAsync();

        return Ok(new
        {
            total = counts.Values.Sum(),
            pending = CountOf(ConcernStatus.Pending),
            underReview = CountOf(ConcernStatus.UnderReview),
            resolved = CountOf(ConcernStatus.Resolved),
            rejected = CountOf(ConcernStatus.Rejected),
            recentSubmissions
        });
    }

    // PUT: api/concerns/{trackingCode}
    [HttpPut("{trackingCode}")]
    [Authorize]
    public async Task<IActionResult> UpdateConcern(
        string trackingCode,
        [FromBody] UpdateConcernRequest request)
    {
        var code = TrackingCode.Normalize(trackingCode);

        if (!TrackingCode.IsValid(code))
            return Error("Invalid tracking code.");

        var newStatus = request.Status?.Trim() ?? string.Empty;
        var newResponse = request.AdminResponse?.Trim() ?? string.Empty;

        if (!ConcernStatus.All.Contains(newStatus))
            return Error("Invalid concern status.");

        if (newResponse.Length > AdminResponseMax)
            return Error($"Admin response must not exceed {AdminResponseMax} characters.");

        var concern = await _context.Concerns.FirstOrDefaultAsync(c => c.TrackingCode == code);

        if (concern is null)
            return NotFound(new { message = "Concern not found." });

        var oldStatus = concern.Status;
        var now = DateTime.UtcNow;
        var adminId = User.GetAdminId();

        await using (var transaction = await _context.Database.BeginTransactionAsync())
        {
            concern.Status = newStatus;
            concern.AdminResponse = newResponse.Length == 0 ? null : newResponse;
            concern.UpdatedAt = now;

            if (oldStatus != newStatus)
            {
                _context.ConcernStatusHistories.Add(new ConcernStatusHistory
                {
                    ConcernId = concern.Id,
                    Status = newStatus,
                    Note = "Concern status updated by administrator.",
                    ChangedByAdminId = adminId,
                    ChangedAt = now
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }

        _logger.LogInformation("Admin {AdminId} updated concern {TrackingCode}: {OldStatus} -> {NewStatus}.",
            adminId, concern.TrackingCode, oldStatus, newStatus);

        await NotifyAsync(concern.TrackingCode, concern.Status);

        return Ok(new
        {
            message = "Concern updated successfully.",
            trackingCode = concern.TrackingCode,
            status = concern.Status,
            adminResponse = concern.AdminResponse ?? string.Empty,
            updatedAt = concern.UpdatedAt
        });
    }

    // ---- Helpers --------------------------------------------------------------

    private BadRequestObjectResult Error(string message) => BadRequest(new { message });

    // A SignalR failure must never fail the request: the change is already saved.
    private async Task NotifyAsync(string trackingCode, string status)
    {
        try
        {
            var payload = new { trackingCode, status };

            await _hub.Clients.Group(ConcernsHub.AdminsGroup)
                .SendAsync("ConcernsChanged", payload);

            await _hub.Clients.Group(ConcernsHub.GroupFor(trackingCode))
                .SendAsync("ConcernUpdated", payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send SignalR notification for {TrackingCode}.", trackingCode);
        }
    }
}

public class SubmitConcernRequest
{
    public string? Category { get; set; }
    public string? Subject { get; set; }
    public string? Description { get; set; }
}

public class UpdateConcernRequest
{
    public string? Status { get; set; }
    public string? AdminResponse { get; set; }
}
