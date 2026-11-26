using Microsoft.Extensions.Diagnostics.HealthChecks;
using Voxora.Api.Data;

namespace Voxora.Api.Infrastructure;

public class DatabaseHealthCheck : IHealthCheck
{
    private readonly VoxoraDbContext _db;

    public DatabaseHealthCheck(VoxoraDbContext db) => _db = db;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Cannot connect to the database.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Cannot connect to the database.", ex);
        }
    }
}
