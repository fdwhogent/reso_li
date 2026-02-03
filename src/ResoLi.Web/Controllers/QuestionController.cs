using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using ResoLi.Web.Hubs;
using ResoLi.Web.Services;

namespace ResoLi.Web.Controllers;

[ApiController]
[Route("api/questions")]
public class QuestionController : ControllerBase
{
    private readonly PollService _pollService;
    private readonly IHubContext<PollHub> _hubContext;

    public QuestionController(PollService pollService, IHubContext<PollHub> hubContext)
    {
        _pollService = pollService;
        _hubContext = hubContext;
    }

    public record UpdateQuestionRequest(string? Title, string Content, bool UseMonospace, bool AllowMultiple);
    public record VoteRequest(List<Guid> OptionIds);

    [HttpGet("{id}")]
    public async Task<IActionResult> GetQuestion(Guid id)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        return Ok(new
        {
            question.Id,
            question.PollId,
            question.Title,
            question.Content,
            question.UseMonospace,
            question.AllowMultiple,
            question.IsActive,
            question.OrderIndex,
            question.ImagePath,
            Options = question.Options.Select(o => new
            {
                o.Id,
                o.Text,
                o.VoteCount,
                o.OrderIndex
            })
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateQuestion(Guid id, [FromBody] UpdateQuestionRequest request, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        var poll = await _pollService.GetPollByCodeAsync(question.Poll?.AccessCode ?? "");
        if (poll == null || !PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        question.Title = request.Title;
        question.Content = request.Content;
        question.UseMonospace = request.UseMonospace;
        question.AllowMultiple = request.AllowMultiple;

        await _pollService.UpdateQuestionAsync(question);
        return Ok(new { success = true });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteQuestion(Guid id, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        var poll = await _pollService.GetPollByCodeAsync(question.Poll?.AccessCode ?? "");
        if (poll == null || !PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        await _pollService.DeleteQuestionAsync(id);
        return Ok(new { success = true });
    }

    [HttpPost("{id}/activate")]
    public async Task<IActionResult> ActivateQuestion(Guid id, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        var poll = await _pollService.GetPollByCodeAsync(question.Poll?.AccessCode ?? "");
        if (poll == null || !PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        await _pollService.ActivateQuestionAsync(question.PollId, id);

        // Notify all clients in this poll
        await _hubContext.Clients.Group(poll.AccessCode).SendAsync("QuestionActivated", id);

        return Ok(new { success = true });
    }

    [HttpPost("{id}/deactivate")]
    public async Task<IActionResult> DeactivateQuestion(Guid id, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        var poll = await _pollService.GetPollByCodeAsync(question.Poll?.AccessCode ?? "");
        if (poll == null || !PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        await _pollService.DeactivateAllQuestionsAsync(question.PollId);

        // Notify all clients
        await _hubContext.Clients.Group(poll.AccessCode).SendAsync("QuestionDeactivated");

        return Ok(new { success = true });
    }

    [HttpPost("{id}/reset")]
    public async Task<IActionResult> ResetVotes(Guid id, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        var poll = await _pollService.GetPollByCodeAsync(question.Poll?.AccessCode ?? "");
        if (poll == null || !PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        await _pollService.ResetQuestionVotesAsync(id);

        var results = await _pollService.GetResultsAsync(id);
        await _hubContext.Clients.Group(poll.AccessCode).SendAsync("VoteUpdate", id, results);

        return Ok(new { success = true });
    }

    [HttpPost("{id}/vote")]
    public async Task<IActionResult> Vote(Guid id, [FromBody] VoteRequest request)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        if (request.OptionIds == null || request.OptionIds.Count == 0)
            return BadRequest(new { error = "At least one option must be selected" });

        var results = await _pollService.VoteAsync(id, request.OptionIds);

        // Broadcast update to all clients
        var poll = await _pollService.GetPollByCodeAsync(question.Poll?.AccessCode ?? "");
        if (poll != null)
        {
            await _hubContext.Clients.Group(poll.AccessCode).SendAsync("VoteUpdate", id, results);
        }

        return Ok(new { success = true, results });
    }

    [HttpGet("{id}/results")]
    public async Task<IActionResult> GetResults(Guid id)
    {
        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        var results = await _pollService.GetResultsAsync(id);
        return Ok(results);
    }
}
