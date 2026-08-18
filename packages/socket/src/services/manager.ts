import { EVENTS } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import type { Permission, User } from "@razzia/common/types/user"
import { getQuizzMeta, getResultsMeta } from "@razzia/socket/services/config"
import { AuthzError, effectivePermission } from "@razzia/socket/services/authz"

/**
 * Emits the config scoped to the acting user:
 *  - admins see every quiz and result
 *  - managers see owned + shared quizzes and their own results
 */
export const emitConfig = (socket: Socket) => {
  const { user } = socket.data

  if (!user) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

    return
  }

  socket.emit(EVENTS.MANAGER.CONFIG, {
    quizz: getQuizzMeta(user),
    results: getResultsMeta(user),
  })
}

/** Resolves the authenticated user attached by the handshake middleware. */
const getUser = (socket: Socket): User | null => socket.data.user ?? null

const isLogged = (socket: Socket): boolean => Boolean(socket.data.user)

const handleError = (socket: Socket, error: unknown) => {
  if (error instanceof AuthzError) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

    return
  }

  console.error("Manager handler error:", error)
  socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:unexpected")
}

/** Gate a handler on an authenticated (any-role) user. */
const withAuth =
  <T extends unknown[]>(
    socket: Socket,
    handler: (_user: User, ..._args: T) => void,
  ) =>
  (..._args: T) => {
    const user = getUser(socket)

    if (!user) {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    try {
      handler(user, ..._args)
    } catch (error) {
      handleError(socket, error)
    }
  }

/** Gate a handler on the admin role. */
const withAdmin = <T extends unknown[]>(
  socket: Socket,
  handler: (_user: User, ..._args: T) => void,
) =>
  withAuth(socket, (user, ..._args: T) => {
    if (user.role !== "admin") {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

      return
    }

    handler(user, ..._args)
  })

export const permissionOn = (user: User, quizId: string): Permission | null =>
  effectivePermission(user, quizId)

export default { getUser, isLogged, withAuth, withAdmin }
