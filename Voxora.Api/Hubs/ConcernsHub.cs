using Microsoft.AspNetCore.SignalR;

namespace Voxora.Api.Hubs;

// Real-time notifications for concerns.
// - "ConcernsChanged" is broadcast to every client (admin pages refresh).
// - "ConcernUpdated" is sent only to clients watching a tracking code.
public class ConcernsHub : Hub
{
    public const string Path = "/hubs/concerns";

    public static string GroupFor(string trackingCode) =>
        "concern:" + trackingCode.Trim().ToUpperInvariant();

    public Task WatchConcern(string trackingCode) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(trackingCode));

    public Task UnwatchConcern(string trackingCode) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupFor(trackingCode));
}
