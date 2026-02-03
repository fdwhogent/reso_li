using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ResoLi.Web.Data;
using ResoLi.Web.Models;

namespace ResoLi.Web.Services;

public class PollService
{
    private readonly AppDbContext _db;

    public PollService(AppDbContext db)
    {
        _db = db;
    }

    public static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(bytes);
    }

    public static bool VerifyPassword(string password, string hash)
    {
        return HashPassword(password) == hash;
    }

    public static bool VerifyAdminPassword(string password)
    {
        var weekday = DateTime.UtcNow.DayOfWeek.ToString().ToLowerInvariant();
        return password.ToLowerInvariant() == weekday;
    }

    public async Task<Poll?> GetPollByCodeAsync(string code)
    {
        return await _db.Polls
            .Include(p => p.Questions.OrderBy(q => q.OrderIndex))
            .ThenInclude(q => q.Options.OrderBy(o => o.OrderIndex))
            .FirstOrDefaultAsync(p => p.AccessCode == code);
    }

    public async Task<Poll?> GetPublicPollAsync()
    {
        return await _db.Polls
            .Include(p => p.Questions.OrderBy(q => q.OrderIndex))
            .ThenInclude(q => q.Options.OrderBy(o => o.OrderIndex))
            .FirstOrDefaultAsync(p => p.IsPublic);
    }

    public async Task<List<Poll>> GetAllPollsAsync()
    {
        return await _db.Polls
            .Include(p => p.Questions)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> AccessCodeExistsAsync(string code)
    {
        return await _db.Polls.AnyAsync(p => p.AccessCode == code);
    }

    public async Task<Poll> CreatePollAsync(string accessCode, string password, DateTime? availableFrom, DateTime? availableUntil)
    {
        var poll = new Poll
        {
            AccessCode = accessCode,
            PasswordHash = HashPassword(password),
            AvailableFrom = availableFrom,
            AvailableUntil = availableUntil
        };

        _db.Polls.Add(poll);
        await _db.SaveChangesAsync();
        return poll;
    }

    public async Task<Poll> UpdatePollAsync(Poll poll)
    {
        _db.Polls.Update(poll);
        await _db.SaveChangesAsync();
        return poll;
    }

    public async Task DeletePollAsync(Guid pollId)
    {
        var poll = await _db.Polls.FindAsync(pollId);
        if (poll != null)
        {
            _db.Polls.Remove(poll);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<Question> AddQuestionAsync(Guid pollId, string? title, string content, bool useMonospace, bool allowMultiple, List<string> options)
    {
        var poll = await _db.Polls.Include(p => p.Questions).FirstOrDefaultAsync(p => p.Id == pollId);
        if (poll == null) throw new InvalidOperationException("Poll not found");

        var question = new Question
        {
            PollId = pollId,
            Title = title,
            Content = content,
            UseMonospace = useMonospace,
            AllowMultiple = allowMultiple,
            OrderIndex = poll.Questions.Count
        };

        for (int i = 0; i < options.Count; i++)
        {
            question.Options.Add(new Option
            {
                Text = options[i],
                OrderIndex = i
            });
        }

        _db.Questions.Add(question);
        await _db.SaveChangesAsync();
        return question;
    }

    public async Task<Question?> GetQuestionAsync(Guid questionId)
    {
        return await _db.Questions
            .Include(q => q.Options.OrderBy(o => o.OrderIndex))
            .FirstOrDefaultAsync(q => q.Id == questionId);
    }

    public async Task UpdateQuestionAsync(Question question)
    {
        _db.Questions.Update(question);
        await _db.SaveChangesAsync();
    }

    public async Task DeleteQuestionAsync(Guid questionId)
    {
        var question = await _db.Questions.FindAsync(questionId);
        if (question != null)
        {
            _db.Questions.Remove(question);
            await _db.SaveChangesAsync();
        }
    }

    public async Task ActivateQuestionAsync(Guid pollId, Guid questionId)
    {
        var questions = await _db.Questions.Where(q => q.PollId == pollId).ToListAsync();
        foreach (var q in questions)
        {
            q.IsActive = q.Id == questionId;
        }
        await _db.SaveChangesAsync();
    }

    public async Task DeactivateAllQuestionsAsync(Guid pollId)
    {
        var questions = await _db.Questions.Where(q => q.PollId == pollId).ToListAsync();
        foreach (var q in questions)
        {
            q.IsActive = false;
        }
        await _db.SaveChangesAsync();
    }

    public async Task ResetQuestionVotesAsync(Guid questionId)
    {
        var options = await _db.Options.Where(o => o.QuestionId == questionId).ToListAsync();
        foreach (var option in options)
        {
            option.VoteCount = 0;
        }
        await _db.SaveChangesAsync();
    }

    public async Task ReorderQuestionsAsync(Guid pollId, List<Guid> questionIds)
    {
        var questions = await _db.Questions.Where(q => q.PollId == pollId).ToListAsync();
        for (int i = 0; i < questionIds.Count; i++)
        {
            var question = questions.FirstOrDefault(q => q.Id == questionIds[i]);
            if (question != null)
            {
                question.OrderIndex = i;
            }
        }
        await _db.SaveChangesAsync();
    }

    public async Task<Dictionary<Guid, int>> VoteAsync(Guid questionId, List<Guid> optionIds)
    {
        var question = await _db.Questions
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == questionId);

        if (question == null) throw new InvalidOperationException("Question not found");

        // For single-choice, only count the first option
        var validOptionIds = question.AllowMultiple ? optionIds : optionIds.Take(1).ToList();

        foreach (var optionId in validOptionIds)
        {
            var option = question.Options.FirstOrDefault(o => o.Id == optionId);
            if (option != null)
            {
                option.VoteCount++;
            }
        }

        await _db.SaveChangesAsync();

        return question.Options.ToDictionary(o => o.Id, o => o.VoteCount);
    }

    public async Task<Dictionary<Guid, int>> GetResultsAsync(Guid questionId)
    {
        var options = await _db.Options
            .Where(o => o.QuestionId == questionId)
            .ToListAsync();

        return options.ToDictionary(o => o.Id, o => o.VoteCount);
    }

    public bool IsPollAvailable(Poll poll)
    {
        var now = DateTime.UtcNow;

        if (poll.AvailableFrom.HasValue && now < poll.AvailableFrom.Value)
            return false;

        if (poll.AvailableUntil.HasValue && now > poll.AvailableUntil.Value)
            return false;

        return true;
    }

    public DateTime? GetPollAvailableFrom(Poll poll)
    {
        return poll.AvailableFrom;
    }
}
