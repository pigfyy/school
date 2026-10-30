import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;

/**
 * A help queue kept as a list and a set, so that join's check for
 * a student already in the queue takes the same time however long
 * the queue is.
 */
public class FastQueue implements HelpQueue {
    // The students waiting, front first.
    private List<String> queue;
    // The same students, for a fast lookup.
    private Set<String> members;
    // RI: no NetID is in queue twice, and members holds exactly
    //     the NetIDs in queue.
    // AF(this) = the help queue of the students in queue, front first.

    public FastQueue() {
        queue = new ArrayList<String>();
        members = new HashSet<String>();
        checkRep();
    }
    /** @requires no NetID is in netids twice
     *  @effects makes a queue of the students given, front first */
    public FastQueue(List<String> netids) {
        // A copy, so that the client cannot change the queue through
        // the list it passed.
        queue = new ArrayList<String>(netids);
        members = new HashSet<String>(netids);
        checkRep();
    }

    private void checkRep() {
        if (!members.equals(new HashSet<String>(queue))) {
            throw new IllegalStateException("members is not the queue");
        }
        if (members.size() != queue.size()) {
            throw new IllegalStateException("someone is in queue twice");
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
        queue.add(netid);
        members.add(netid);
        checkRep();
    }

    public String next() {
        checkRep();
        if (queue.isEmpty()) {
            throw new NoSuchElementException("nobody is waiting");
        }
        String front = queue.remove(0);
        members.remove(front);
        checkRep();
        return front;
    }

    public List<String> waiting() {
        checkRep();
        return new ArrayList<String>(queue);
    }
}
