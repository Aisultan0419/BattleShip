using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ShipBattle.Services;
using ShipBattle.Models;
using ShipBattle.Infrastructure;

namespace ShipBattle.Hubs;

public class BattleHub : Hub
{
    private readonly GameSessionManager _sessionManager;
    private readonly GameValidationService _validationService;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<BattleHub> _hubContext;
    public BattleHub(
        GameSessionManager sessionManager,
        GameValidationService validationService,
        IServiceScopeFactory scopeFactory,
        IHubContext<BattleHub> hubContext) 
    {
        _sessionManager = sessionManager;
        _validationService = validationService;
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
    }

    private Guid GetUserId()
    {
        if (Context.Items.TryGetValue("UserId", out var userIdObj) && userIdObj is Guid userId)
            return userId;
        throw new HubException("Unauthorized");
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext != null && Guid.TryParse(httpContext.Request.Query["userId"], out var userId))
        {
            Context.Items["UserId"] = userId;
            _sessionManager.CancelDisconnectTimer(userId);

            var roomId = _sessionManager.GetRoomByUser(userId);
            if (roomId != null)
            {
                var session = _sessionManager.GetSession(roomId);
                if (session != null)
                {
                    lock (session.SyncRoot)
                    {
                        if (session.Players.TryGetValue(userId, out var player))
                        {
                            player.ConnectionId = Context.ConnectionId;
                        }
                    }
                    await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
                    await SendGameState(session, Context.ConnectionId);
                }
            }
        }
        else
        {
            Context.Abort();
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue("UserId", out var userIdObj) && userIdObj is Guid userId)
        {
            var roomId = _sessionManager.GetRoomByUser(userId);
            if (roomId != null)
            {
                _sessionManager.StartDisconnectTimer(userId, async () =>
                {
                    var session = _sessionManager.GetSession(roomId);
                    if (session != null)
                    {
                        lock (session.SyncRoot)
                        {
                            if (session.State == GameState.GameOver) return;
                            session.State = GameState.GameOver;
                        }

                        var winnerId = session.Players.Keys.FirstOrDefault(k => k != userId);
                        if (winnerId != Guid.Empty)
                        {
                            await HandleGameOverDbUpdate(winnerId, userId);

                            await _hubContext.Clients.Group(roomId).SendAsync("GameOver", winnerId);
                        }

                        _sessionManager.RemoveSession(roomId);
                        _sessionManager.RemoveUserMapping(userId);
                        if (winnerId != Guid.Empty)
                        {
                            _sessionManager.RemoveUserMapping(winnerId);
                        }
                    }
                });
            }
        }
        await base.OnDisconnectedAsync(exception);
    }
    private List<int[]> GetSunkShipCoordinates(CellState[,] board, int startX, int startY, int gridSize)
    {
        var queue = new Queue<(int x, int y)>();
        var visited = new bool[gridSize, gridSize];
        var shipCoords = new List<int[]>();
        queue.Enqueue((startX, startY));
        visited[startX, startY] = true;
        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            shipCoords.Add(new[] { x, y });
            var neighbors = new[] { (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1) };
            foreach (var (nx, ny) in neighbors)
            {
                if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize)
                {
                    if (board[nx, ny] == CellState.Ship) return null;
                    if (board[nx, ny] == CellState.Hit && !visited[nx, ny])
                    {
                        visited[nx, ny] = true;
                        queue.Enqueue((nx, ny));
                    }
                }
            }
        }
        return shipCoords; 
    }
    public async Task<string> CreateRoom(int gridSize, int maxShipSize)
    {
        var userId = GetUserId();
        var session = _sessionManager.CreateSession(gridSize, maxShipSize);

        lock (session.SyncRoot)
        {
            session.Players[userId] = new PlayerState
            {
                UserId = userId,
                ConnectionId = Context.ConnectionId,
                Board = new CellState[gridSize, gridSize] 
            };
        }

        _sessionManager.MapUserToRoom(userId, session.RoomId);
        await Groups.AddToGroupAsync(Context.ConnectionId, session.RoomId);

        return session.RoomId;
    }

    public async Task JoinRoom(string roomId)
    {
        var userId = GetUserId();
        var session = _sessionManager.GetSession(roomId);

        if (session == null) throw new HubException("Room not found");

        lock (session.SyncRoot)
        {
            if (session.Players.ContainsKey(userId))
            {
                session.Players[userId].ConnectionId = Context.ConnectionId;
            }
            else if (session.Players.Count < 2)
            {
                session.Players[userId] = new PlayerState
                {
                    UserId = userId,
                    ConnectionId = Context.ConnectionId,
                    Board = new CellState[session.GridSize, session.GridSize] 
                };
                _sessionManager.MapUserToRoom(userId, roomId);
            }
            else
            {
                throw new HubException("Room is full");
            }
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        _sessionManager.CancelDisconnectTimer(userId);

        bool startGame = false;
        lock (session.SyncRoot)
        {
            if (session.Players.Count == 2 && session.State == GameState.WaitingForPlayer)
            {
                session.State = GameState.PlacingShips;
                startGame = true;
            }
        }

        if (startGame)
        {
            await SendGameState(session, Context.ConnectionId);

            await Clients.Group(roomId).SendAsync("GameStarted");
        }
        else
        {
            await SendGameState(session, Context.ConnectionId);
        }
    }

    public async Task PlaceShips(string roomId, int[][] ships)
    {
        var userId = GetUserId();
        var session = _sessionManager.GetSession(roomId);

        if (session == null) return;

        lock (session.SyncRoot)
        {
            if (session.State != GameState.PlacingShips) return;
            if (!session.Players.TryGetValue(userId, out var player) || player.IsReady) return;

            if (!_validationService.ValidateShipPlacement(ships, session.GridSize, session.MaxShipSize))
            {
                Clients.Caller.SendAsync("InvalidPlacement");
                return;
            }

            for (int i = 0; i < ships.Length; i++)
            {
                player.Board[ships[i][0], ships[i][1]] = CellState.Ship;
            }

            player.AliveShipCells = ships.Length; 
            player.IsReady = true;

            if (session.Players.Values.All(p => p.IsReady))
            {
                session.State = GameState.Battle;
                session.CurrentTurnUserId = session.Players.Keys.First();
                Clients.Group(roomId).SendAsync("BattlePhaseStarted", session.CurrentTurnUserId);
            }
        }
    }

    public async Task MakeShot(string roomId, int x, int y)
    {
        var userId = GetUserId();
        var session = _sessionManager.GetSession(roomId);
        if (session == null) return;
        bool isHit = false;
        bool isGameOver = false;
        Guid winnerId = Guid.Empty;
        List<int[]> sunkShipCoords = null; 
        lock (session.SyncRoot)
        {
            if (session.State != GameState.Battle || session.CurrentTurnUserId != userId) return;
            if (x < 0 || x >= session.GridSize || y < 0 || y >= session.GridSize) return;
            var opponentId = session.Players.Keys.First(k => k != userId);
            var opponent = session.Players[opponentId];
            var cellState = opponent.Board[x, y];
            if (cellState == CellState.Hit || cellState == CellState.Miss || cellState == CellState.Sunk) return;
            isHit = cellState == CellState.Ship;
            opponent.Board[x, y] = isHit ? CellState.Hit : CellState.Miss;
            if (isHit)
            {
                opponent.AliveShipCells--;
                sunkShipCoords = GetSunkShipCoordinates(opponent.Board, x, y, session.GridSize);
                if (sunkShipCoords != null)
                {
                    foreach (var coord in sunkShipCoords)
                    {
                        opponent.Board[coord[0], coord[1]] = CellState.Sunk;
                    }
                }
                if (opponent.AliveShipCells <= 0)
                {
                    session.State = GameState.GameOver;
                    isGameOver = true;
                    winnerId = userId;
                }
            }
            else
            {
                session.CurrentTurnUserId = opponentId;
            }
        }
        await Clients.Group(roomId).SendAsync("ReceiveShotResult", x, y, isHit);

        if (sunkShipCoords != null)
        {
            await Clients.Group(roomId).SendAsync("ShipSunk", sunkShipCoords, userId);
        }
        if (isGameOver)
        {
            await HandleGameOverDbUpdate(winnerId, session.Players.Keys.First(k => k != winnerId));
            await Clients.Group(roomId).SendAsync("GameOver", winnerId);
            _sessionManager.RemoveSession(roomId);
            foreach (var p in session.Players.Keys)
            {
                _sessionManager.RemoveUserMapping(p);
            }
        }
    }

    private async Task HandleGameOverDbUpdate(Guid winnerId, Guid loserId)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        await dbContext.Users
            .Where(u => u.Id == winnerId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Wins, u => u.Wins + 1));

        await dbContext.Users
            .Where(u => u.Id == loserId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Losses, u => u.Losses + 1));
    }

    private async Task SendGameState(GameSession session, string connectionId)
    {
        GameStateDto dto;
        lock (session.SyncRoot)
        {
            dto = new GameStateDto
            {
                RoomId = session.RoomId,
                State = session.State,
                CurrentTurnUserId = session.CurrentTurnUserId,
                GridSize = session.GridSize,
                MaxShipSize = session.MaxShipSize,
                Players = session.Players.ToDictionary(
                    k => k.Key,
                    v => new PlayerStateDto
                    {
                        IsReady = v.Value.IsReady,
                        Board = v.Key == GetUserId() ? ConvertToJagged(v.Value.Board, session.GridSize) : HideShips(v.Value.Board, session.GridSize)
                    })
            };
        }
        await Clients.Client(connectionId).SendAsync("ReceiveGameState", dto);
    }
    private CellState[][] ConvertToJagged(CellState[,] original, int size)
    {
        var jagged = new CellState[size][];
        for (int i = 0; i < size; i++)
        {
            jagged[i] = new CellState[size];
            for (int j = 0; j < size; j++)
            {
                jagged[i][j] = original[i, j];
            }
        }
        return jagged;
    }
    private CellState[][] HideShips(CellState[,] original, int size)
    {
        var hidden = new CellState[size][];
        for (int i = 0; i < size; i++)
        {
            hidden[i] = new CellState[size];
            for (int j = 0; j < size; j++)
            {
                hidden[i][j] = original[i, j] == CellState.Ship ? CellState.Empty : original[i, j];
            }
        }
        return hidden;
    }
}