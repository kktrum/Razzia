import { EVENTS } from "@razzia/common/constants"
import type { Player } from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import { usernameValidator } from "@razzia/common/validators/auth"
import { getClientId } from "@razzia/socket/utils/socket"

/**
 * How long a player keeps their slot in a not-yet-started game after their
 * socket drops. Mobile browsers tear the websocket down within ~30s of the
 * screen locking, so without a grace period anyone who pockets their phone
 * while waiting in the lobby is deleted from the game outright and bounced to
 * the home screen ("game not found") when they come back.
 */
const LOBBY_GRACE_MS = 2 * 60 * 1000

export class PlayerManager {
  private readonly io: Server
  private readonly gameId: string
  private readonly getManagerId: () => string
  private players: Player[] = []
  /** Pending grace-period removals for dropped lobby players, by clientId. */
  private readonly pendingRemovals = new Map<
    string,
    ReturnType<typeof setTimeout>
  >()

  constructor(io: Server, gameId: string, getManagerId: () => string) {
    this.io = io
    this.gameId = gameId
    this.getManagerId = getManagerId
  }

  join(socket: Socket, username: string): void {
    const clientId = getClientId(socket)

    if (this.findByClientId(clientId)) {
      socket.emit(
        EVENTS.GAME.ERROR_MESSAGE,
        "errors:game.playerAlreadyConnected",
      )

      return
    }

    const result = usernameValidator.safeParse(username)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    socket.join(this.gameId)

    const player: Player = {
      id: socket.id,
      clientId,
      connected: true,
      username,
      points: 0,
      streak: 0,
    }

    this.players.push(player)
    this.io.to(this.getManagerId()).emit(EVENTS.MANAGER.NEW_PLAYER, player)
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)
    socket.emit(EVENTS.GAME.SUCCESS_JOIN, this.gameId)
  }

  kick(socket: Socket, playerId: string): boolean {
    if (this.getManagerId() !== socket.id) {
      return false
    }

    const player = this.findById(playerId)

    if (!player) {
      return false
    }

    this.cancelRemoval(player.clientId)
    this.players = this.players.filter((p) => p.id !== playerId)

    this.io.in(playerId).socketsLeave(this.gameId)
    this.io.to(player.id).emit(EVENTS.GAME.RESET, "errors:game.kickedByManager")
    this.io
      .to(this.getManagerId())
      .emit(EVENTS.MANAGER.PLAYER_KICKED, player.id)
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)

    return true
  }

  remove(socketId: string): Player | undefined {
    const player = this.findById(socketId)

    if (!player) {
      return undefined
    }

    this.cancelRemoval(player.clientId)
    this.players = this.players.filter((p) => p.id !== socketId)

    return player
  }

  /**
   * Runs `onExpire` if the player hasn't reconnected within the grace period.
   * Call `cancelRemoval` on reconnect.
   */
  scheduleRemoval(socketId: string, onExpire: (_player: Player) => void): void {
    const player = this.findById(socketId)

    if (!player) {
      return
    }

    this.cancelRemoval(player.clientId)

    const timer = setTimeout(() => {
      this.pendingRemovals.delete(player.clientId)

      if (player.connected) {
        return
      }

      onExpire(player)
    }, LOBBY_GRACE_MS)

    timer.unref()
    this.pendingRemovals.set(player.clientId, timer)
  }

  cancelRemoval(clientId: string): void {
    const timer = this.pendingRemovals.get(clientId)

    if (timer) {
      clearTimeout(timer)
      this.pendingRemovals.delete(clientId)
    }
  }

  clearRemovals(): void {
    for (const timer of this.pendingRemovals.values()) {
      clearTimeout(timer)
    }

    this.pendingRemovals.clear()
  }

  setDisconnected(socketId: string): void {
    const player = this.findById(socketId)

    if (player) {
      player.connected = false
    }
  }

  updateSocketId(oldId: string, newId: string): void {
    const player = this.findById(oldId)

    if (player) {
      player.id = newId
    }
  }

  replace(players: Player[]): void {
    this.players = players
  }

  findById(socketId: string): Player | undefined {
    return this.players.find((p) => p.id === socketId)
  }

  findByClientId(clientId: string): Player | undefined {
    return this.players.find((p) => p.clientId === clientId)
  }

  getAll(): Player[] {
    return this.players
  }

  count(): number {
    return this.players.length
  }

  broadcastCount(): void {
    this.io.to(this.gameId).emit(EVENTS.GAME.TOTAL_PLAYERS, this.players.length)
  }
}
