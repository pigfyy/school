import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;

/** A help queue kept as one list of the students in it. */
public class ListQueue implements HelpQueue {
    private List<String> queue = new ArrayList<String>();

    public int size() {
        return queue.size();
    }

    public void join(String netid) {
        if (queue.contains(netid)) {
            throw new IllegalArgumentException(netid + " is in the queue");
        }
        queue.add(netid);
    }

    public String next() {
        if (queue.isEmpty()) {
            throw new NoSuchElementException("the queue is empty");
        }
        return queue.remove(0);
    }

    public List<String> waiting() {
        // A copy, so that a client cannot change the queue through it.
        return new ArrayList<String>(queue);
    }
}
