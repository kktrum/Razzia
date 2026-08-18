import type { Socket } from "@razzia/common/types/game/socket"

export const getClientId = (socket: Socket): string =>
  socket.handshake.auth.clientId as string

/**
 * Wraps a raw socket.io listener so a malformed/missing payload (e.g. a
 * destructuring failure when a client emits with no argument) is caught and
 * logged instead of throwing. socket.io's internal dispatch does not wrap
 * listener calls in try/catch, so an uncaught throw here would otherwise
 * crash the whole process for every connected user.
 */
export const safeOn =
  <T extends unknown[]>(handler: (..._args: T) => void) =>
  (..._args: T) => {
    try {
      handler(..._args)
    } catch (error) {
      console.error("Socket handler error:", error)
    }
  }
