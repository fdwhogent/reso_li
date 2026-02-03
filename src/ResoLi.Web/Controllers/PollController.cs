using Microsoft.AspNetCore.Mvc;
using ResoLi.Web.Models;
using ResoLi.Web.Services;

namespace ResoLi.Web.Controllers;

[ApiController]
[Route("api/polls")]
public class PollController : ControllerBase
{
    private readonly PollService _pollService;

    public PollController(PollService pollService)
    {
        _pollService = pollService;
    }

    public record CreatePollRequest(string AccessCode, string Password, DateTime? AvailableFrom, DateTime? AvailableUntil);
    public record AuthRequest(string Password);
    public record UpdatePollRequest(DateTime? AvailableFrom, DateTime? AvailableUntil);
    public record AddQuestionRequest(string? Title, string Content, bool UseMonospace, bool AllowMultiple, List<string> Options);
    public record UpdateQuestionRequest(string? Title, string Content, bool UseMonospace, bool AllowMultiple, List<OptionUpdate> Options);
    public record OptionUpdate(Guid? Id, string Text, int OrderIndex);
    public record ReorderRequest(List<Guid> QuestionIds);

    [HttpPost]
    public async Task<IActionResult> CreatePoll([FromBody] CreatePollRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AccessCode))
            return BadRequest(new { error = "Access code is required" });

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "Password is required" });

        if (await _pollService.AccessCodeExistsAsync(request.AccessCode))
            return Conflict(new { error = "Access code already exists" });

        var poll = await _pollService.CreatePollAsync(
            request.AccessCode,
            request.Password,
            request.AvailableFrom,
            request.AvailableUntil);

        return Ok(new { poll.Id, poll.AccessCode });
    }

    [HttpGet("{code}")]
    public async Task<IActionResult> GetPoll(string code)
    {
        var poll = await _pollService.GetPollByCodeAsync(code);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        var isAvailable = _pollService.IsPollAvailable(poll);
        var availableFrom = _pollService.GetPollAvailableFrom(poll);

        return Ok(new
        {
            poll.Id,
            poll.AccessCode,
            poll.CreatedAt,
            poll.AvailableFrom,
            poll.AvailableUntil,
            poll.IsPublic,
            IsAvailable = isAvailable,
            AvailableFromUtc = availableFrom,
            Questions = poll.Questions.Select(q => new
            {
                q.Id,
                q.Title,
                q.Content,
                q.UseMonospace,
                q.AllowMultiple,
                q.IsActive,
                q.OrderIndex,
                q.ImagePath,
                Options = q.Options.Select(o => new
                {
                    o.Id,
                    o.Text,
                    o.VoteCount,
                    o.OrderIndex
                })
            })
        });
    }

    [HttpGet("public")]
    public async Task<IActionResult> GetPublicPoll()
    {
        var poll = await _pollService.GetPublicPollAsync();
        if (poll == null)
            return NotFound(new { error = "No public poll available" });

        var isAvailable = _pollService.IsPollAvailable(poll);

        return Ok(new
        {
            poll.Id,
            poll.AccessCode,
            poll.CreatedAt,
            poll.AvailableFrom,
            poll.AvailableUntil,
            poll.TimeoutMinutes,
            IsAvailable = isAvailable,
            Questions = poll.Questions.Select(q => new
            {
                q.Id,
                q.Title,
                q.Content,
                q.UseMonospace,
                q.AllowMultiple,
                q.IsActive,
                q.OrderIndex,
                q.ImagePath,
                Options = q.Options.Select(o => new
                {
                    o.Id,
                    o.Text,
                    o.VoteCount,
                    o.OrderIndex
                })
            })
        });
    }

    [HttpPost("{code}/auth")]
    public async Task<IActionResult> Authenticate(string code, [FromBody] AuthRequest request)
    {
        var poll = await _pollService.GetPollByCodeAsync(code);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        if (!PollService.VerifyPassword(request.Password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        return Ok(new { success = true, pollId = poll.Id });
    }

    [HttpPut("{code}")]
    public async Task<IActionResult> UpdatePoll(string code, [FromBody] UpdatePollRequest request, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var poll = await _pollService.GetPollByCodeAsync(code);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        if (!PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        poll.AvailableFrom = request.AvailableFrom;
        poll.AvailableUntil = request.AvailableUntil;

        await _pollService.UpdatePollAsync(poll);
        return Ok(new { success = true });
    }

    [HttpDelete("{code}")]
    public async Task<IActionResult> DeletePoll(string code, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var poll = await _pollService.GetPollByCodeAsync(code);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        if (!PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        await _pollService.DeletePollAsync(poll.Id);
        return Ok(new { success = true });
    }

    [HttpPost("{code}/questions")]
    public async Task<IActionResult> AddQuestion(string code, [FromBody] AddQuestionRequest request, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var poll = await _pollService.GetPollByCodeAsync(code);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        if (!PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        if (request.Options == null || request.Options.Count < 2)
            return BadRequest(new { error = "At least 2 options are required" });

        var question = await _pollService.AddQuestionAsync(
            poll.Id,
            request.Title,
            request.Content,
            request.UseMonospace,
            request.AllowMultiple,
            request.Options);

        return Ok(new
        {
            question.Id,
            question.Title,
            question.Content,
            question.UseMonospace,
            question.AllowMultiple,
            question.OrderIndex,
            Options = question.Options.Select(o => new { o.Id, o.Text, o.OrderIndex })
        });
    }

    [HttpPut("{code}/questions/reorder")]
    public async Task<IActionResult> ReorderQuestions(string code, [FromBody] ReorderRequest request, [FromHeader(Name = "X-Poll-Password")] string password)
    {
        var poll = await _pollService.GetPollByCodeAsync(code);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        if (!PollService.VerifyPassword(password, poll.PasswordHash))
            return Unauthorized(new { error = "Invalid password" });

        await _pollService.ReorderQuestionsAsync(poll.Id, request.QuestionIds);
        return Ok(new { success = true });
    }
}
