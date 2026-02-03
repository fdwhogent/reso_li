using Microsoft.AspNetCore.Mvc;
using ResoLi.Web.Data;
using ResoLi.Web.Models;
using ResoLi.Web.Services;

namespace ResoLi.Web.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly PollService _pollService;
    private readonly AppDbContext _db;
    private readonly IWebHostEnvironment _env;

    public AdminController(PollService pollService, AppDbContext db, IWebHostEnvironment env)
    {
        _pollService = pollService;
        _db = db;
        _env = env;
    }

    public record AdminAuthRequest(string Password);
    public record SetPublicPollRequest(string AccessCode, int? TimeoutMinutes);

    [HttpPost("auth")]
    public IActionResult Authenticate([FromBody] AdminAuthRequest request)
    {
        if (!PollService.VerifyAdminPassword(request.Password))
            return Unauthorized(new { error = "Invalid password" });

        return Ok(new { success = true });
    }

    [HttpGet("polls")]
    public async Task<IActionResult> GetAllPolls([FromHeader(Name = "X-Admin-Password")] string password)
    {
        if (!PollService.VerifyAdminPassword(password))
            return Unauthorized(new { error = "Invalid admin password" });

        var polls = await _pollService.GetAllPollsAsync();
        return Ok(polls.Select(p => new
        {
            p.Id,
            p.AccessCode,
            p.CreatedAt,
            p.AvailableFrom,
            p.AvailableUntil,
            p.IsPublic,
            p.TimeoutMinutes,
            QuestionCount = p.Questions.Count
        }));
    }

    [HttpPost("public")]
    public async Task<IActionResult> SetPublicPoll([FromBody] SetPublicPollRequest request, [FromHeader(Name = "X-Admin-Password")] string password)
    {
        if (!PollService.VerifyAdminPassword(password))
            return Unauthorized(new { error = "Invalid admin password" });

        // Remove public flag from current public poll
        var currentPublic = await _pollService.GetPublicPollAsync();
        if (currentPublic != null)
        {
            currentPublic.IsPublic = false;
            currentPublic.TimeoutMinutes = null;
            await _pollService.UpdatePollAsync(currentPublic);
        }

        // Set new public poll
        var poll = await _pollService.GetPollByCodeAsync(request.AccessCode);
        if (poll == null)
            return NotFound(new { error = "Poll not found" });

        poll.IsPublic = true;
        poll.TimeoutMinutes = request.TimeoutMinutes;
        await _pollService.UpdatePollAsync(poll);

        return Ok(new { success = true });
    }

    [HttpDelete("public")]
    public async Task<IActionResult> RemovePublicPoll([FromHeader(Name = "X-Admin-Password")] string password)
    {
        if (!PollService.VerifyAdminPassword(password))
            return Unauthorized(new { error = "Invalid admin password" });

        var currentPublic = await _pollService.GetPublicPollAsync();
        if (currentPublic != null)
        {
            currentPublic.IsPublic = false;
            currentPublic.TimeoutMinutes = null;
            await _pollService.UpdatePollAsync(currentPublic);
        }

        return Ok(new { success = true });
    }

    [HttpPost("questions/{id}/image")]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file, [FromHeader(Name = "X-Admin-Password")] string password)
    {
        if (!PollService.VerifyAdminPassword(password))
            return Unauthorized(new { error = "Invalid admin password" });

        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded" });

        // Validate file type
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest(new { error = "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." });

        // Generate unique filename
        var extension = Path.GetExtension(file.FileName);
        var filename = $"{Guid.NewGuid()}{extension}";
        var uploadsPath = Path.Combine(_env.WebRootPath, "uploads");

        if (!Directory.Exists(uploadsPath))
            Directory.CreateDirectory(uploadsPath);

        var filePath = Path.Combine(uploadsPath, filename);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Delete old image if exists
        if (!string.IsNullOrEmpty(question.ImagePath))
        {
            var oldPath = Path.Combine(_env.WebRootPath, question.ImagePath.TrimStart('/'));
            if (System.IO.File.Exists(oldPath))
                System.IO.File.Delete(oldPath);
        }

        question.ImagePath = $"/uploads/{filename}";
        await _pollService.UpdateQuestionAsync(question);

        return Ok(new { success = true, imagePath = question.ImagePath });
    }

    [HttpDelete("questions/{id}/image")]
    public async Task<IActionResult> DeleteImage(Guid id, [FromHeader(Name = "X-Admin-Password")] string password)
    {
        if (!PollService.VerifyAdminPassword(password))
            return Unauthorized(new { error = "Invalid admin password" });

        var question = await _pollService.GetQuestionAsync(id);
        if (question == null)
            return NotFound(new { error = "Question not found" });

        if (!string.IsNullOrEmpty(question.ImagePath))
        {
            var filePath = Path.Combine(_env.WebRootPath, question.ImagePath.TrimStart('/'));
            if (System.IO.File.Exists(filePath))
                System.IO.File.Delete(filePath);

            question.ImagePath = null;
            await _pollService.UpdateQuestionAsync(question);
        }

        return Ok(new { success = true });
    }
}
