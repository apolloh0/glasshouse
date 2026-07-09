// CONTRACT (D7) — ids are pre-order integers starting at 0, assigned in a
// single pass over the finished tree. Same source string => same ids. The
// parser must build nodes with id = -1 and call assignNodeIds exactly once.
import type { Program } from "./ast.js";
import { TODO } from "../util/todo.js";

/** Walk the whole Program (items, all nested exprs/stmts) in pre-order,
 *  assign 0,1,2,..., set program.nodeCount, and return the program. */
export function assignNodeIds(program: Program): Program {
  void program;
  TODO("T2", "pre-order id assignment");
}
