using Microsoft.AspNetCore.SignalR;

namespace ResoLi.Web.Hubs;

public class PollHub : Hub
{
    public async Task JoinPoll(string pollCode)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, pollCode);
    }

    public async Task LeavePoll(string pollCode)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, pollCode);
    }
}
