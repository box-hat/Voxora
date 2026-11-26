
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using Voxora.Api.Data;
using Voxora.Api.Hubs;
using Voxora.Api.Models;

namespace Voxora.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConcernsController : ControllerBase
{
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

    // Notify connected clients. A SignalR failure must never fail the request,
    // since the database change has already been committed.
    private async Task NotifyAsync(string trackingCode, string status)
    {
        try
        {
            var payload = new { trackingCode, status };

            await _hub.Clients.All.SendAsync("ConcernsChanged", payload);

            await _hub.Clients
                .Group(ConcernsHub.GroupFor(trackingCode))
                .SendAsync("ConcernUpdated", payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to send SignalR notification for {TrackingCode}",
                trackingCode);
        }
    }

    // POST: api/concerns
    // SUBMIT CONCERN
    [HttpPost]
    public async Task<IActionResult> SubmitConcern(
        [FromBody] SubmitConcernRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Category))
            return BadRequest("Please select a concern category.");

        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest("Subject is required.");

        if (request.Subject.Trim().Length < 5 ||
            request.Subject.Trim().Length > 100)
            return BadRequest("Subject must be 5 to 100 characters.");

        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest("Description is required.");

        if (request.Description.Trim().Length < 10 ||
            request.Description.Trim().Length > 2000)
            return BadRequest("Description must be 10 to 2000 characters.");

        var category = await _context.Categories
            .FirstOrDefaultAsync(c =>
                c.Name == request.Category.Trim() &&
                c.IsActive);

        if (category == null)
            return BadRequest("Selected category was not found.");

        string trackingCode;

        do
        {
            trackingCode = "VX-" +
                RandomNumberGenerator.GetInt32(10000000, 100000000);
        }
        while (await _context.Concerns.AnyAsync(
            c => c.TrackingCode == trackingCode));

        var now = DateTime.UtcNow;

        var concern = new Concern
        {
            TrackingCode = trackingCode,
            CategoryId = category.Id,
            Subject = request.Subject.Trim(),
            Description = request.Description.Trim(),
            Status = "Pending",
            AdminResponse = null,
            AssignedAdminId = null,
            IsAnonymous = true,
            SubmittedAt = now,
            UpdatedAt = null
        };

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            _context.Concerns.Add(concern);
            await _context.SaveChangesAsync();

            var history = new ConcernStatusHistory
            {
                ConcernId = concern.Id,
                Status = "Pending",
                Note = "Your concern has been successfully submitted.",
                ChangedByAdminId = null,
                ChangedAt = now
            };

            _context.ConcernStatusHistories.Add(history);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();

            await NotifyAsync(concern.TrackingCode, concern.Status);

            return Ok(new
            {
                message = "Concern submitted successfully.",
                trackingCode = concern.TrackingCode,
                status = concern.Status,
                submittedAt = concern.SubmittedAt
            });
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();

            return StatusCode(
                500,
                "Unable to save your concern. Please try again."
            );
        }
    }

    // GET: api/concerns
    // GET ALL CONCERNS FOR ADMIN
    [HttpGet]
    public async Task<IActionResult> GetAllConcerns()
    {
        var concerns = await (
            from concern in _context.Concerns
            join category in _context.Categories
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
                adminResponse = concern.AdminResponse ?? ""
            }
        ).ToListAsync();

        return Ok(concerns);
    }

    // GET: api/concerns/report-summary
    // Lightweight data for the reports page: database aggregates and latest rows.
    [HttpGet("report-summary")]
    public async Task<IActionResult> GetReportSummary()
    {
        var statusCounts = await _context.Concerns
            .AsNoTracking()
            .GroupBy(c => c.Status)
            .Select(group => new
            {
                status = group.Key,
                count = group.Count()
            })
            .ToListAsync();

        var categoryCounts = await (
            from concern in _context.Concerns.AsNoTracking()
            join category in _context.Categories.AsNoTracking()
                on concern.CategoryId equals category.Id
            group concern by category.Name into categoryGroup
            orderby categoryGroup.Count() descending
            select new
            {
                name = categoryGroup.Key,
                count = categoryGroup.Count()
            }
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
        )
        .Take(10)
        .ToListAsync();

        return Ok(new
        {
            statusCounts,
            categoryCounts,
            recentConcerns
        });
    }

    // GET: api/concerns/dashboard-summary
    // ADMIN DASHBOARD SUMMARY
    [HttpGet("dashboard-summary")]
    public async Task<IActionResult> GetDashboardSummary()
    {
        var total = await _context.Concerns.CountAsync();

        var pending = await _context.Concerns
            .CountAsync(c => c.Status == "Pending");

        var underReview = await _context.Concerns
            .CountAsync(c => c.Status == "Under Review");

        var resolved = await _context.Concerns
            .CountAsync(c => c.Status == "Resolved");

        var rejected = await _context.Concerns
            .CountAsync(c => c.Status == "Rejected");

        var recentSubmissions = await (
            from concern in _context.Concerns
            join category in _context.Categories
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
        )
        .Take(5)
        .ToListAsync();

        return Ok(new
        {
            total,
            pending,
            underReview,
            resolved,
            rejected,
            recentSubmissions
        });
    }

    // PUT: api/concerns/{trackingCode}
    // UPDATE CONCERN STATUS AND ADMIN RESPONSE
    [HttpPut("{trackingCode}")]
    public async Task<IActionResult> UpdateConcern(
        string trackingCode,
        [FromBody] UpdateConcernRequest request)
    {
        if (string.IsNullOrWhiteSpace(trackingCode))
            return BadRequest("Tracking code is required.");

        var code = trackingCode.Trim().ToUpper();

        var concern = await _context.Concerns
            .FirstOrDefaultAsync(c => c.TrackingCode == code);

        if (concern == null)
            return NotFound("Concern not found.");

        var allowedStatuses = new[]
        {
            "Pending",
            "Under Review",
            "Resolved",
            "Rejected"
        };

        if (string.IsNullOrWhiteSpace(request.Status) ||
            !allowedStatuses.Contains(request.Status.Trim()))
        {
            return BadRequest("Invalid concern status.");
        }

        if (request.AdminResponse?.Trim().Length > 2000)
            return BadRequest("Admin response must not exceed 2000 characters.");

        var newStatus = request.Status.Trim();
        var newResponse = request.AdminResponse?.Trim() ?? "";

        var oldStatus = concern.Status;
        var now = DateTime.UtcNow;

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            concern.Status = newStatus;
            concern.AdminResponse = string.IsNullOrWhiteSpace(newResponse)
                ? null
                : newResponse;
            concern.UpdatedAt = now;

            if (oldStatus != newStatus)
            {
                var history = new ConcernStatusHistory
                {
                    ConcernId = concern.Id,
                    Status = newStatus,
                    Note = "Concern status updated by administrator.",
                    ChangedByAdminId = null,
                    ChangedAt = now
                };

                _context.ConcernStatusHistories.Add(history);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await NotifyAsync(concern.TrackingCode, concern.Status);

            return Ok(new
            {
                message = "Concern updated successfully.",
                trackingCode = concern.TrackingCode,
                status = concern.Status,
                adminResponse = concern.AdminResponse ?? "",
                updatedAt = concern.UpdatedAt
            });
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();

            return StatusCode(
                500,
                "Unable to update concern. Please try again."
            );
        }
    }

    // GET: api/concerns/{trackingCode}
    // TRACK CONCERN
    [HttpGet("{trackingCode}")]
    public async Task<IActionResult> GetConcernByTrackingCode(
        string trackingCode)
    {
        if (string.IsNullOrWhiteSpace(trackingCode))
            return BadRequest("Tracking code is required.");

        var code = trackingCode.Trim().ToUpper();

        var concern = await _context.Concerns
            .FirstOrDefaultAsync(c =>
                c.TrackingCode == code);

        if (concern == null)
            return NotFound("Concern not found.");

        var category = await _context.Categories
            .FirstOrDefaultAsync(c =>
                c.Id == concern.CategoryId);

        var history = await _context.ConcernStatusHistories
            .Where(h => h.ConcernId == concern.Id)
            .OrderBy(h => h.ChangedAt)
            .Select(h => new
            {
                status = h.Status,
                date = h.ChangedAt,
                note = h.Note
            })
            .ToListAsync();

        return Ok(new
        {
            trackingCode = concern.TrackingCode,
            category = category != null ? category.Name : "Unknown",
            subject = concern.Subject,
            description = concern.Description,
            submittedAt = concern.SubmittedAt,
            status = concern.Status,
            adminResponse = concern.AdminResponse ?? "",
            statusHistory = history
        });
    }
}

// SUBMIT REQUEST MODEL
public class SubmitConcernRequest
{
    public string Category { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

// UPDATE REQUEST MODEL
public class UpdateConcernRequest
{
    public string Status { get; set; } = string.Empty;
    public string? AdminResponse { get; set; }
}
