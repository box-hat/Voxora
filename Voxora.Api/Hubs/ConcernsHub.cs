using Microsoft.AspNetCore.SignalR;
using Voxora.Api.Models;

namespace Voxora.Api.Hubs;

// Real-time notifications for concerns.
// - "ConcernsChanged" goes only to signed-in admins (admin pages refresh).
//   It must never reach anonymous clients: it carries tracking codes.
// - "ConcernUpdated" goes only to clients watching that tracking code,
//   i.e. people who already know it.
public class ConcernsHub : Hub
{
    public const string Path = "/hubs/concerns";
    public const string AdminsGroup = "admins";

    public static string GroupFor(string trackingCode) =>
        "concern:" + TrackingCode.Normalize(trackingCode);

    public override async Task OnConnectedAsync()
    {
        if (Context.User?.Identity?.IsAuthenticated == true)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminsGroup);
        }

        await base.OnConnectedAsync();
    }

    public Task WatchConcern(string trackingCode)
    {
        if (!TrackingCode.IsValid(TrackingCode.Normalize(trackingCode)))
            throw new HubException("Invalid tracking code.");

        return Groups.AddToGroupAsync(Context.ConnectionId, GroupFor(trackingCode));
    }

    public Task UnwatchConcern(string trackingCode) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupFor(trackingCode));
}
