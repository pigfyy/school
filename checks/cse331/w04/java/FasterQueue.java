import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

/**
 * A help queue kept as two stacks and a set: join adds at the end of
 * one list, next removes from the end of the other, and the set
 * answers join's check, so that neither walks the whole queue.
 */
public class FasterQueue implements HelpQueue {
    // The students who joined since the last refill, oldest first.
    private List<String> inbox;
    // The students ahead of them, with the front of the queue last.
    private List<String> outbox;
    // The same students, for a fast lookup.
    private Set<String> members;
    // RI: no NetID is in inbox or outbox twice, or in both, and
    //     members holds exactly the NetIDs in inbox and outbox.
    // AF(this) = the help queue of the students in outbox, last to
    //     first, then the students in inbox, first to last.

    public FasterQueue() {
        inbox = new ArrayList<String>();
        outbox = new ArrayList<String>();
        members = new HashSet<String>();
        checkRep();
    }
    /** @requires no NetID is in netids twice
     *  @effects makes a queue of the students given, front first */
    public FasterQueue(List<String> netids) {
        // A copy, so that the client cannot change the queue through
        // the list it passed.
        inbox = new ArrayList<String>(netids);
        outbox = new ArrayList<String>();
        members = new HashSet<String>(netids);
        checkRep();
    }

    private void checkRep() {
        Set<String> waiting = new HashSet<String>(inbox);
        waiting.addAll(outbox);
        if (!members.equals(waiting)) {
            throw new IllegalStateException("members is not the queue");
        }
        if (members.size() != inbox.size() + outbox.size()) {
            throw new IllegalStateException("someone is in the queue twice");
        }
    }

    public int size() {
        checkRep();
        return members.size();
    }

    public void join(String netid) {
        checkRep();
        if (members.contains(netid)) {
            throw new IllegalArgumentException(netid + " is in the queue");
        }
        inbox.add(netid);
        members.add(netid);
        checkRep();
    }

    public String next() {
        checkRep();
        if (members.isEmpty()) {
            throw new NoSuchElementException("nobody is waiting");
        }
        // When the outbox runs dry, move the inbox over in reverse, so
        // that the front of the queue is at the end of the outbox.
        if (outbox.isEmpty()) {
            for (int i = inbox.size() - 1; i >= 0; i--) {
                outbox.add(inbox.get(i));
            }
            inbox.clear();
        }
        String front = outbox.remove(outbox.size() - 1);
        members.remove(front);
        checkRep();
        return front;
    }

    public List<String> waiting() {
        checkRep();
        List<String> list = new ArrayList<String>();
        for (int i = outbox.size() - 1; i >= 0; i--) {
            list.add(outbox.get(i));
        }
        list.addAll(inbox);
        return list;
    }
}
