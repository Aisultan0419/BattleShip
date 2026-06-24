using System.Collections.Concurrent;
using ShipBattle.Models;

namespace ShipBattle.Services;

public class GameSessionManager
{
    private readonly ConcurrentDictionary<string, GameSession> _sessions = new();
    private readonly ConcurrentDictionary<Guid, CancellationTokenSource> _disconnectTimers = new();
    private readonly ConcurrentDictionary<Guid, string> _userToRoom = new();

    public GameSession CreateSession(int gridSize, int maxShipSize)
    {
        string roomId;
        GameSession session;

        do
        {
            roomId = Guid.NewGuid().ToString("N").Substring(0, 6);
            session = new GameSession
            {
                RoomId = roomId,
                GridSize = gridSize,
                MaxShipSize = maxShipSize
            };
        } while (!_sessions.TryAdd(roomId, session));

        return session;
    }

    public GameSession? GetSession(string roomId)
    {
        _sessions.TryGetValue(roomId, out var session);
        return session;
    }

    public void RemoveSession(string roomId)
    {
        _sessions.TryRemove(roomId, out _);
    }

    public void MapUserToRoom(Guid userId, string roomId)
    {
        _userToRoom.AddOrUpdate(userId, roomId, (_, _) => roomId);
    }

    public string? GetRoomByUser(Guid userId)
    {
        _userToRoom.TryGetValue(userId, out var roomId);
        return roomId;
    }

    public void RemoveUserMapping(Guid userId)
    {
        _userToRoom.TryRemove(userId, out _);
    }

    public void StartDisconnectTimer(Guid userId, Action onTimeout)
    {
        var cts = new CancellationTokenSource();

        _disconnectTimers.AddOrUpdate(userId, cts, (_, oldCts) =>
        {
            oldCts.Cancel();
            oldCts.Dispose();
            return cts;
        });

        Task.Delay(TimeSpan.FromSeconds(60), cts.Token).ContinueWith(t =>
        {
            if (!t.IsCanceled)
            {
                onTimeout();
            }
            _disconnectTimers.TryRemove(userId, out _);
        });
    }

    public void CancelDisconnectTimer(Guid userId)
    {
        if (_disconnectTimers.TryRemove(userId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }
    }
}